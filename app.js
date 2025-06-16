const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

// Inisialisasi cache (TTL = Time To Live, dalam detik)
const myCache = new NodeCache({ stdTTL: 3600 }); 

// Base URL API SPMB
const BASE_REGISTRATION_API_URL = "https://spmb.jabarprov.go.id/api/public/registration";
const BASE_SCHOOL_API_URL = "https://spmb.jabarprov.go.id/api/public/school";
const BASE_CADISDIK_API_URL = "https://spmb.jabarprov.go.id/api/public/cadisdik"; 

// Mapping tipe opsi pendaftaran ke nilai API
const OPTION_TYPES = {
    'DOMISILI': 'zonasi',
    'KETM': 'ketm',
    'MUTASI': 'perpindahan'
};

// --- Middleware dan Konfigurasi Express ---
app.use(express.static(path.join(__dirname, 'public')));

// Set engine view untuk HTML
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html'); // <--- PASTIKAN BARIS INI ADA DAN DI SINI!

// --- Fungsi untuk Mengambil Daftar Cabang Dinas (Cadisdik ID dan Nama Tampilan) ---
async function fetchCadisdikMapping() { 
    const cacheKey = 'jabar_cadisdik_mapping';
    let cadisdikMapping = myCache.get(cacheKey);

    if (!cadisdikMapping) {
        console.log('[API Fetch] Fetching Cadisdik mapping from new API...');
        cadisdikMapping = {}; 

        try {
            const response = await axios.get(`${BASE_CADISDIK_API_URL}?limit=100`, { timeout: 15000 }); 
            const cadisdikList = response.data.result; 

            cadisdikList.sort((a, b) => parseInt(a.cadisdik) - parseInt(b.cadisdik));

            cadisdikList.forEach(item => {
                const cadisdikId = item.cadisdik;
                const citiesText = item.city.join(', '); 
                const displayName = citiesText; 
                cadisdikMapping[cadisdikId] = displayName;
            });
            
            myCache.set(cacheKey, cadisdikMapping);
            console.log(`[API Fetch] Finished fetching Cadisdik mapping. Total: ${Object.keys(cadisdikMapping).length}`);
        } catch (error) {
            console.error(`[API Error] Error fetching Cadisdik API:`, error.message);
            cadisdikMapping = {
                "1": "BOGOR, KOTA BOGOR, KOTA DEPOK", 
                "2": "KOTA BOGOR, KOTA DEPOK",
                "3": "BEKASI, KOTA BEKASI",
                "4": "KARAWANG, PURWAKARTA, SUBANG",
                "5": "SUKABUMI, KOTA SUKABUMI",
                "6": "BANDUNG BARAT, CIANJUR",
                "7": "KOTA BANDUNG, KOTA CIMAHI",
                "8": "BANDUNG, SUMEDANG",
                "9": "INDRAMAYU, MAJALENGKA",
                "10": "CIREBON, KUNINGAN, KOTA CIREBON",
                "11": "GARUT",
                "12": "TASIKMALAYA, KOTA TASIKMALAYA",
                "13": "CIAMIS, PANGANDARAN, KOTA BANJAR"
            };
            console.log('[API Fetch] Using static Cadisdik list as fallback.');
        }
    }
    return cadisdikMapping;
}


// --- Fungsi untuk Mengambil Daftar Sekolah berdasarkan Cadisdik ID ---
async function fetchSchoolsByCadisdik(cadisdikId, limit = 100) { 
    if (!cadisdikId) { 
        return {};
    }

    const cacheKey = `schools_cadisdik_${cadisdikId}`; 
    let schools = myCache.get(cacheKey);

    if (!schools) {
        console.log(`[API Fetch] Fetching schools for Cadisdik ID: ${cadisdikId} from API...`);
        let allSchools = [];
        let pageNum = 1;
        let totalPages = 1;

        while (pageNum <= totalPages) {
            const params = {
                page: pageNum,
                limit: limit, 
                'filters[1][key]': 'level',
                'filters[1][value]': 'sma',
                'filters[0][key]': 'cadisdik', 
                'filters[0][value]': cadisdikId, 
                'filters[2][key]': 'type',
                'filters[2][value]': 'negeri', 
                'columns[0][key]': 'name',
                'columns[0][searchable]': true,
                'columns[1][key]': 'npsn',
                'columns[1][searchable]': true,
                'search': '' 
            };

            try {
                const response = await axios.get(BASE_SCHOOL_API_URL, { params: params, timeout: 15000 });
                const responseData = response.data.result.itemsList;
                const paginationInfo = response.data.result.paginator;

                if (responseData && Array.isArray(responseData)) {
                    allSchools = allSchools.concat(responseData);
                }

                if (paginationInfo) {
                    totalPages = paginationInfo.page_count;
                } else {
                    totalPages = pageNum;
                }
                pageNum++;
                if (pageNum <= totalPages) {
                    await new Promise(resolve => setTimeout(resolve, 300)); 
                }
            } catch (error) {
                console.error(`[API Error] Error fetching schools for Cadisdik ${cadisdikId} page ${pageNum}:`, error.message);
                if (error.response) {
                    console.error(`[API Error] Status: ${error.response.status}, Response Data: ${JSON.stringify(error.response.data)}`);
                }
                break;
            }
        }
        schools = allSchools.reduce((acc, school) => {
            if (school.npsn && school.name) {
                acc[school.npsn] = school.name;
            }
            return acc;
        }, {});
        myCache.set(cacheKey, schools);
        console.log(`[API Fetch] Fetched ${Object.keys(schools).length} schools for Cadisdik ${cadisdikId}.`);
    }
    return schools;
}

// Fungsi untuk Mengambil Data Pendaftaran (Tidak Berubah)
async function fetchRegistrationData(npsn, optionType, limit = 100) { 
    if (!npsn || !optionType) { 
        return [];
    }
    const apiValue = OPTION_TYPES[optionType.toUpperCase()] || 'zonasi';
    
    let allData = [];
    let pageNum = 1;
    let totalPages = 1; 

    console.log(`[API Fetch] Starting to fetch registration data for NPSN: ${npsn}, Option Type: ${optionType} (API value: ${apiValue})`);

    while (pageNum <= totalPages) {
        const params = {
            page: pageNum,
            limit: limit, 
            orderby: 'distance_1', 
            order: 'asc',         
            pagination: true,
            'columns[0][key]': 'name',
            'columns[0][searchable]': false,
            'columns[1][key]': 'registration_number',
            'columns[1][searchable]': true,
            npsn: npsn, 
            'filters[1][key]': 'option_type',
            'filters[1][value]': apiValue,
            'major_id': '' 
        };

        try {
            console.log(`[API Request] Requesting registration page ${pageNum}/${totalPages} for ${npsn} (${apiValue})...`);
            const response = await axios.get(BASE_REGISTRATION_API_URL, { params: params, timeout: 15000 });
            
            const responseData = response.data.result.itemsList; 
            const paginationInfo = response.data.result.paginator;

            if (responseData && Array.isArray(responseData)) {
                allData = allData.concat(responseData);
            }

            if (paginationInfo) {
                totalPages = paginationInfo.page_count; 
                console.log(`[Pagination Info] Total pages for ${npsn} (${apiValue}): ${totalPages}, Current: ${pageNum}`);
            } else {
                totalPages = pageNum;
            }

            pageNum++;
            if (pageNum <= totalPages) { 
                await new Promise(resolve => setTimeout(resolve, 500)); 
            }
            
        } catch (error) {
            console.error(`[API Error] Error fetching registration data for ${npsn} (${optionType}) page ${pageNum}:`, error.message);
            if (error.response) {
                console.error(`[API Error] Status: ${error.response.status}, Response Data: ${JSON.stringify(error.response.data)}`);
            }
            break; 
        }
    }
    console.log(`[API Fetch] Finished fetching registration data for ${npsn} (${optionType}). Total items collected: ${allData.length}`);
    return allData;
}

// --- Endpoint untuk halaman utama ---
app.get('/', async (req, res) => {
    const cadisdikMapping = await fetchCadisdikMapping(); 
    res.render('index', { 
        optionTypes: Object.keys(OPTION_TYPES),
        cadisdikMapping: cadisdikMapping 
    }); 
});

// --- Endpoint API untuk mendapatkan daftar Cabang Dinas/Wilayah ---
app.get('/api/cadisdik', async (req, res) => {
    const cadisdikMapping = await fetchCadisdikMapping();
    res.json(cadisdikMapping); 
});

// --- Endpoint API untuk mendapatkan daftar sekolah berdasarkan ID Cadisdik ---
app.get('/api/schools', async (req, res) => {
    const cadisdikId = req.query.cadisdik_id; // Ambil cadisdik_id dari query
    const schools = await fetchSchoolsByCadisdik(cadisdikId);
    res.json(schools);
});


// --- Endpoint API untuk mendapatkan data pendaftar (dengan filter dan ranking kustom) ---
app.get('/api/data', async (req, res) => {
    const npsn = req.query.npsn; 
    const optionType = req.query.option_type; 
    const search_query = req.query.search ? req.query.search.toLowerCase() : '';
    const min_distance = req.query.min_distance ? parseFloat(req.query.min_distance) : null;
    const max_distance = req.query.max_distance ? parseFloat(req.query.max_distance) : null;

    if (!npsn || !optionType) { 
        return res.json([]);
    }

    const cacheKey = `registration_data_${npsn}_${optionType.toLowerCase()}`;
    let data = myCache.get(cacheKey);

    if (!data) {
        console.log(`[Cache] Data for NPSN ${npsn} and ${optionType} not in cache or expired. Fetching from API now...`);
        data = await fetchRegistrationData(npsn, optionType); 
        myCache.set(cacheKey, data);
        console.log(`[Cache] Data for NPSN ${npsn} and ${optionType} fetched and cached.`);
    } else {
        console.log(`[Cache] Data for NPSN ${npsn} and ${optionType} served from cache.`);
    }

    let filtered_data = [];
    data.forEach((entry) => { 
        let match_search = true;
        if (search_query) {
            if (!(entry.name.toLowerCase().includes(search_query) ||
                  entry.registration_number.toLowerCase().includes(search_query) ||
                  (entry.first_option_name && entry.first_option_name.toLowerCase().includes(search_query)) ||
                  (entry.second_option_name && entry.second_option_name.toLowerCase().includes(search_query)) ||
                  (entry.third_option_name && entry.third_option_name.toLowerCase().includes(search_query)))) {
                match_search = false;
            }
        }

        let match_distance = true;
        if (min_distance !== null || max_distance !== null) {
            const distances = [entry.distance_1, entry.distance_2, entry.distance_3].filter(d => d !== null);
            
            if (distances.length === 0) { 
                match_distance = false;
            } else {
                const closest_distance = Math.min(...distances);
                if (closest_distance !== null) { 
                    if (min_distance !== null && closest_distance < min_distance) {
                        match_distance = false;
                    }
                    if (max_distance !== null && closest_distance > max_distance) {
                        match_distance = false;
                    }
                } else {
                    match_distance = false;
                }
            }
        }

        if (match_search && match_distance) {
            filtered_data.push(entry);
        }
    });

    // --- LOGIKA PENGURUTAN (RANKING) BARU DI SINI ---
    filtered_data.sort((a, b) => {
        // Prioritas 1: Jarak terdekat (ascending - terdekat duluan)
        const distance1A = a.distance_1 !== null ? a.distance_1 : Infinity; // Atasi jika distance_1 null
        const distance1B = b.distance_1 !== null ? b.distance_1 : Infinity;

        if (distance1A !== distance1B) {
            return distance1A - distance1B; // Urutkan dari jarak terdekat ke terjauh
        }

        // Prioritas 2: Jika jarak sama, urutkan berdasarkan Score (descending - tertinggi duluan)
        const scoreA = a.score !== null ? a.score : -Infinity; // Atasi jika score null
        const scoreB = b.score !== null ? b.score : -Infinity;
        
        return scoreB - scoreA; // Urutkan dari score tertinggi ke terendah
    });

    const final_ranked_data = filtered_data.map((item, index) => ({
        ...item,
        ranking_filtered: index + 1 
    }));

    res.json(final_ranked_data); 
});

// Jalankan server Express
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Web Wrapper for SPMB Jabar is ready!`);
    console.log(`Remember to install all dependencies: npm install express axios node-cache ejs`);
});
