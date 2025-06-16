const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

// Inisialisasi cache (TTL = Time To Live, dalam detik)
const myCache = new NodeCache({ stdTTL: 300 });

// Base URL API SPMB
const BASE_API_URL = "https://spmb.jabarprov.go.id/api/public/registration";

// --- DAFTAR SEKOLAH (UPDATE DENGAN DATA DARI ANDA) ---
const SCHOOLS = {
    "20227904": "SMAN 1 CIKANCUNG", // Default
    "20206145": "SMAN 1 CIPARAY",
    "20227905": "SMAN 1 KATAPANG",
    "20227889": "SMAN 1 DAYEUHKOLOT",
    "20227900": "SMAN 1 NAGREG",
    "20227907": "SMAN 1 MARGAASIH",
    "20206210": "SMAN 1 MAJALAYA",
    "20251792": "SMAN 1 CICALENGKA",
    "20254054": "SMAN 1 RANCAEKEK",
    "20206151": "SMAN 1 BALEENDAH",
    "20251793": "SMAN 1 CILEUNYI",
    "20206207": "SMAN 1 PANGALENGAN",
    "20206209": "SMAN 1 MARGAHAYU",
    "20206213": "SMAN 1 CIWIDEY",
    "20206205": "SMAN 1 SOREANG",
    "20251791": "SMAN 1 BANJARAN",
    "20254167": "SMAN 2 MAJALAYA",
    "20227903": "SMAN 1 BOJONGSOANG",
    "20227906": "SMAN 1 KERTASARI",
    "70053450": "SMA NEGERI 1 PASIR JAMBU"
};
const DEFAULT_NPSN = "20227904"; // SMAN 1 CIKANCUNG sebagai default

// Mapping tipe opsi ke nilai API
const OPTION_TYPES = {
    'DOMISILI': 'zonasi',
    'KETM': 'ketm',
    'MUTASI': 'perpindahan'
};

// Middleware untuk menyajikan file statis (CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Set engine view untuk HTML
app.set('views', path.join(__dirname, 'views'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// Fungsi untuk mengambil data dari API SPMB
async function fetchSPMBData(npsn, optionType, limit = 100) { 
    const apiValue = OPTION_TYPES[optionType.toUpperCase()] || 'zonasi';
    
    let allData = [];
    let pageNum = 1;
    let totalPages = 1; 

    console.log(`[API Fetch] Starting to fetch data for NPSN: ${npsn}, Option Type: ${optionType} (API value: ${apiValue})`);

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
            console.log(`[API Request] Requesting page ${pageNum}/${totalPages} for ${npsn} (${apiValue})...`);
            const response = await axios.get(BASE_API_URL, { params: params, timeout: 15000 });
            
            const responseData = response.data.result.itemsList; 
            const paginationInfo = response.data.result.paginator;

            if (responseData && Array.isArray(responseData)) {
                allData = allData.concat(responseData);
            }

            if (paginationInfo) {
                totalPages = paginationInfo.page_count; 
                console.log(`[Pagination Info] Total pages for ${apiValue}: ${totalPages}, Current: ${pageNum}`);
            } else {
                totalPages = pageNum;
            }

            pageNum++;
            if (pageNum <= totalPages) { 
                await new Promise(resolve => setTimeout(resolve, 500)); 
            }
            
        } catch (error) {
            console.error(`[API Error] Error fetching API for ${npsn} (${optionType}) page ${pageNum}:`, error.message);
            if (error.response) {
                console.error(`[API Error] Status: ${error.response.status}, Response Data: ${JSON.stringify(error.response.data)}`);
            }
            break; 
        }
    }
    console.log(`[API Fetch] Finished fetching data for ${npsn} (${optionType}). Total items collected: ${allData.length}`);
    return allData;
}

// Endpoint untuk halaman utama
app.get('/', (req, res) => {
    res.render('index', { 
        optionTypes: Object.keys(OPTION_TYPES),
        schools: SCHOOLS, 
        defaultNPSN: DEFAULT_NPSN
    }); 
});

// Endpoint API untuk mendapatkan data pendaftar (dengan filter dan ranking kustom)
app.get('/api/data', async (req, res) => {
    const npsn = req.query.npsn || DEFAULT_NPSN; 
    const optionType = req.query.option_type || 'DOMISILI'; 
    const search_query = req.query.search ? req.query.search.toLowerCase() : '';
    const min_distance = req.query.min_distance ? parseFloat(req.query.min_distance) : null;
    const max_distance = req.query.max_distance ? parseFloat(req.query.max_distance) : null;

    const cacheKey = `spmb_data_${npsn}_${optionType.toLowerCase()}`;
    let data = myCache.get(cacheKey);

    if (!data) {
        console.log(`[Cache] Data for NPSN ${npsn} and ${optionType} not in cache or expired. Fetching from API now...`);
        data = await fetchSPMBData(npsn, optionType); 
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

    // Logika Pengurutan Ranking
    filtered_data.sort((a, b) => {
        const scoreA = a.score !== null ? a.score : -Infinity; 
        const scoreB = b.score !== null ? b.score : -Infinity;

        if (scoreA !== scoreB) {
            return scoreB - scoreA; 
        }

        const distance1A = a.distance_1 !== null ? a.distance_1 : Infinity; 
        const distance1B = b.distance_1 !== null ? b.distance_1 : Infinity;
        
        return distance1A - distance1B; 
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