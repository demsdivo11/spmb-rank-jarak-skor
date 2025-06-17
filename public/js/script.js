document.addEventListener('DOMContentLoaded', function() {
    const cadisdikFilter = document.getElementById('cadisdikFilter'); 
    const schoolFilter = document.getElementById('schoolFilter');
    const optionTypeFilter = document.getElementById('optionTypeFilter');
    const originSchoolFilter = document.getElementById('originSchoolFilter'); 
    const searchInput = document.getElementById('searchInput');
    const minDistanceInput = document.getElementById('minDistanceInput');
    const maxDistanceInput = document.getElementById('maxDistanceInput');
    const applyFiltersButton = document.getElementById('applyFilters');
    const clearFiltersButton = document.getElementById('clearFilters');
    const dataTableBody = document.querySelector('#dataTable tbody');
    const loadingMessage = document.getElementById('loadingMessage');
    const noDataMessage = document.getElementById('noDataMessage');

    const schoolSummaryTableBody = document.querySelector('#schoolSummaryTable tbody');
    const schoolSummaryLoading = document.getElementById('schoolSummaryLoading');
    const noSummaryData = document.getElementById('noSummaryData');

    // Elemen untuk Kuota Pendaftar
    const quotaSection = document.querySelector('.quota-section');
    const quotaSchoolName = document.getElementById('quotaSchoolName');
    const quotaLoading = document.getElementById('quotaLoading');
    const quotaTableBody = document.querySelector('#quotaTable tbody');
    const noQuotaData = document.getElementById('noQuotaData');


    // --- Fungsi untuk mengisi dropdown sekolah ---
    async function populateSchoolFilter(cadisdikId) { 
        schoolFilter.innerHTML = '<option value="" disabled selected>Memuat sekolah...</option>';
        schoolFilter.disabled = true;

        if (!cadisdikId) { 
            schoolFilter.innerHTML = '<option value="" disabled selected>Pilih Cabang Dinas/Wilayah dahulu</option>';
            return;
        }

        try {
            const response = await fetch(`/api/schools?cadisdik_id=${encodeURIComponent(cadisdikId)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const schools = await response.json(); 

            schoolFilter.innerHTML = ''; 
            schoolFilter.disabled = false;

            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "Silakan pilih sekolah tujuan";
            defaultOption.disabled = true;
            defaultOption.selected = true;
            schoolFilter.appendChild(defaultOption);

            if (Object.keys(schools).length === 0) {
                schoolFilter.innerHTML += '<option value="" disabled>Tidak ada sekolah ditemukan</option>'; 
            } else {
                for (const npsn in schools) {
                    const option = document.createElement('option');
                    option.value = npsn;
                    option.textContent = `${schools[npsn]} (${npsn})`;
                    schoolFilter.appendChild(option);
                }
            }
        } catch (error) {
            console.error('Error fetching schools:', error);
            schoolFilter.innerHTML = '<option value="" disabled selected>Gagal memuat sekolah</option>';
            schoolFilter.disabled = false;
        }
    }


    // --- Fungsi untuk mengisi dropdown Asal Sekolah Pendaftar ---
    function populateOriginSchoolFilter(uniqueSchools) {
        originSchoolFilter.innerHTML = ''; 
        originSchoolFilter.disabled = false;

        const allOption = document.createElement('option');
        allOption.value = "ALL_SCHOOLS";
        allOption.textContent = "Semua Asal Sekolah";
        originSchoolFilter.appendChild(allOption);

        uniqueSchools.forEach(schoolName => {
            const option = document.createElement('option');
            option.value = schoolName;
            option.textContent = schoolName;
            originSchoolFilter.appendChild(option);
        });
    }


    // Fungsi untuk menghitung rekapitulasi asal sekolah
    function generateSchoolSummary(data) {
        const schoolCounts = {};
        let totalPendaftar = 0;

        data.forEach(item => {
            const schoolName = item.school_name || 'Tidak Diketahui';
            schoolCounts[schoolName] = (schoolCounts[schoolName] || 0) + 1;
            totalPendaftar++;
        });

        const sortedSchools = Object.entries(schoolCounts).sort(([, countA], [, countB]) => countB - countA);

        schoolSummaryTableBody.innerHTML = ''; 
        if (sortedSchools.length === 0) {
            noSummaryData.style.display = 'block';
            noSummaryData.textContent = 'Tidak ada data rekapitulasi asal sekolah.';
        } else {
            noSummaryData.style.display = 'none';
            sortedSchools.forEach(([school, count]) => {
                const percentage = totalPendaftar > 0 ? ((count / totalPendaftar) * 100).toFixed(2) : 0;
                const row = schoolSummaryTableBody.insertRow();
                row.insertCell().textContent = school;
                row.insertCell().textContent = count;
                row.insertCell().textContent = `${percentage}%`;
            });
        }
        schoolSummaryLoading.style.display = 'none';
    }


    // --- Fungsi untuk Mengambil dan Menampilkan Data Kuota ---
    async function fetchAndDisplayQuotaData(npsn) {
        quotaSchoolName.textContent = ''; 
        quotaLoading.style.display = 'block';
        quotaTableBody.innerHTML = '';
        noQuotaData.style.display = 'none';
        quotaSection.style.display = 'block'; 

        if (!npsn) {
            quotaLoading.style.display = 'none';
            noQuotaData.textContent = 'Pilih sekolah untuk melihat data kuota.';
            noQuotaData.style.display = 'block';
            return;
        }

        try {
            console.log(`[Frontend Debug] Meminta data kuota untuk NPSN: ${npsn}`); 
            const response = await fetch(`/api/school-details?npsn=${encodeURIComponent(npsn)}`);
            
            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`[Frontend Debug] Error HTTP ${response.status} saat mengambil kuota:`, errorBody); 
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json(); 

            console.log(`[Frontend Debug] Data kuota yang berhasil diurai:`, data); 

            quotaLoading.style.display = 'none';
            quotaSchoolName.textContent = data.schoolName || 'Tidak Diketahui'; 

            if (!data || (!data.statistics && !data.options)) { 
                noQuotaData.textContent = 'Tidak ada data kuota ditemukan untuk sekolah ini.';
                noQuotaData.style.display = 'block';
                return;
            }

            const combinedQuotaData = {}; 

            // Step 1: Inisialisasi dengan data dari 'options' (kuota awal/sisa)
            if (data.options) {
                data.options.forEach(option => {
                    combinedQuotaData[option.type] = { // Kunci berdasarkan option.type (misal: 'zonasi', 'anak-guru')
                        jenisKuota: option.name, // Nama yang ditampilkan (misal: "SMAN 1 CIKANCUNG - DOMISILI")
                        initialQuota: option.initial_quota,
                        quota: option.quota,
                        totalRegistration: 'N/A', // Default N/A, akan diupdate dari statistics
                        totalVerified: 'N/A',
                        totalNotVerified: 'N/A',
                        totalCanceled: 'N/A'
                    };
                });
            }

            // Step 2: Perbarui dengan data dari 'statistics' (jumlah pendaftaran)
            if (data.statistics) {
                data.statistics.forEach(stat => {
                    // Cari 'type' yang sesuai di array 'options' berdasarkan nama 'stat.option'
                    const correspondingOption = data.options ? data.options.find(opt => opt.name === stat.option) : null;
                    const keyToUpdate = correspondingOption ? correspondingOption.type : stat.option; // Gunakan type jika ditemukan, jika tidak, pakai nama mentah dari stat

                    // Pastikan entri ini sudah ada atau buat baru jika hanya ada di statistics
                    if (!combinedQuotaData[keyToUpdate]) {
                         combinedQuotaData[keyToUpdate] = {
                             jenisKuota: stat.option, // Jika tidak ada di options, gunakan nama ini
                             initialQuota: 'N/A', 
                             quota: 'N/A',
                         };
                    }
                    
                    combinedQuotaData[keyToUpdate].totalRegistration = stat.total_registration;
                    combinedQuotaData[keyToUpdate].totalVerified = stat.total_verified;
                    combinedQuotaData[keyToUpdate].totalNotVerified = stat.total_not_verified;
                    combinedQuotaData[keyToUpdate].totalCanceled = stat.total_canceled;
                });
            }

            const sortedCombinedData = Object.values(combinedQuotaData).sort((a,b) => a.jenisKuota.localeCompare(b.jenisKuota));


            if (sortedCombinedData.length === 0) {
                noQuotaData.textContent = 'Tidak ada data kuota ditemukan untuk sekolah ini.';
                noQuotaData.style.display = 'block';
            } else {
                noQuotaData.style.display = 'none'; 
                sortedCombinedData.forEach(item => {
                    const row = quotaTableBody.insertRow();
                    row.insertCell().textContent = item.jenisKuota;
                    row.insertCell().textContent = item.initialQuota !== undefined && item.initialQuota !== null ? item.initialQuota : 'N/A';
                    row.insertCell().textContent = item.quota !== undefined && item.quota !== null ? item.quota : 'N/A';
                    row.insertCell().textContent = item.totalRegistration !== undefined && item.totalRegistration !== null ? item.totalRegistration : 'N/A';
                    row.insertCell().textContent = item.totalVerified !== undefined && item.totalVerified !== null ? item.totalVerified : 'N/A';
                    row.insertCell().textContent = item.totalNotVerified !== undefined && item.totalNotVerified !== null ? item.totalNotVerified : 'N/A';
                    row.insertCell().textContent = item.totalCanceled !== undefined && item.totalCanceled !== null ? item.totalCanceled : 'N/A';
                });
            }

        } catch (error) {
            console.error('Error fetching quota data (pastikan API mengembalikan JSON valid):', error); 
            quotaLoading.style.display = 'none';
            noQuotaData.textContent = 'Gagal memuat data kuota. Silakan coba lagi.'; 
            noQuotaData.style.display = 'block';
        }
    }


    async function fetchData(npsn, optionType, originSchoolName, searchQuery = '', minDistance = '', maxDistance = '') { 
        // Sembunyikan pesan lama dan bersihkan tabel
        loadingMessage.style.display = 'none';
        noDataMessage.style.display = 'none';
        schoolSummaryLoading.style.display = 'none';
        noSummaryData.style.display = 'none';
        dataTableBody.innerHTML = ''; 
        schoolSummaryTableBody.innerHTML = ''; 
        originSchoolFilter.disabled = true; 
        
        // Sembunyikan/bersihkan kuota data saat loading
        quotaLoading.style.display = 'none'; 
        quotaTableBody.innerHTML = ''; 
        noQuotaData.style.display = 'none'; 
        quotaSchoolName.textContent = ''; 


        if (!cadisdikFilter.value || !npsn || !optionType) {
            loadingMessage.textContent = 'Silakan pilih Cabang Dinas/Wilayah, Sekolah Tujuan, dan Jenis Pendaftaran.';
            loadingMessage.style.display = 'block';
            noDataMessage.style.display = 'block'; 
            noSummaryData.style.display = 'block'; 
            quotaSection.style.display = 'none'; 
            return;
        }

        loadingMessage.textContent = 'Memuat data pendaftar... Mohon tunggu sebentar.';
        loadingMessage.style.display = 'block';
        schoolSummaryLoading.textContent = 'Memuat rekapitulasi...';
        schoolSummaryLoading.style.display = 'block';
        quotaLoading.textContent = 'Memuat data kuota...';
        quotaLoading.style.display = 'block'; 


        try {
            // Panggil API data pendaftar
            const params = new URLSearchParams();
            params.append('npsn', npsn); 
            params.append('option_type', optionType); 
            params.append('cadisdik_id', cadisdikFilter.value); 
            if (originSchoolName && originSchoolName !== 'ALL_SCHOOLS') params.append('origin_school_name', originSchoolName); 
            if (searchQuery) params.append('search', searchQuery);
            if (minDistance) params.append('min_distance', minDistance);
            if (maxDistance) params.append('max_distance', maxDistance);

            const response = await fetch(`/api/data?${params.toString()}`);
            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`[Frontend Debug] Error HTTP ${response.status} saat mengambil data pendaftar:`, errorBody);
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            const result = await response.json(); 
            const data = result.filteredData; 
            const uniqueOriginSchools = result.uniqueOriginSchools; 

            loadingMessage.style.display = 'none';
            schoolSummaryLoading.style.display = 'none'; 
            
            populateOriginSchoolFilter(uniqueOriginSchools); 

            if (data.length === 0) {
                noDataMessage.style.display = 'block';
                noDataMessage.textContent = 'Tidak ada data pendaftar ditemukan untuk kriteria ini.';
                noSummaryData.style.display = 'block';
                noSummaryData.textContent = 'Tidak ada data rekapitulasi asal sekolah.';
            } else {
                noDataMessage.style.display = 'none';
                generateSchoolSummary(data); 

                data.forEach(item => {
                    const row = dataTableBody.insertRow();
                    row.insertCell().textContent = item.ranking_filtered !== undefined ? item.ranking_filtered : 'N/A';
                    row.insertCell().textContent = item.score !== null ? item.score.toFixed(3) : 'N/A';
                    row.insertCell().textContent = item.registration_number; 
                    
                    const nameCell = row.insertCell();
                    if (searchQuery && item.name.toLowerCase().includes(searchQuery)) {
                        const regex = new RegExp(`(${searchQuery})`, 'gi');
                        nameCell.innerHTML = item.name.replace(regex, `<span class="highlight">$1</span>`);
                    } else {
                        nameCell.textContent = item.name;
                    }
                    
                    row.insertCell().textContent = item.school_name || 'N/A'; 
                    row.insertCell().textContent = item.first_option_name || 'N/A'; 
                    row.insertCell().textContent = item.distance_1 !== null ? item.distance_1 : 'N/A'; 
                    row.insertCell().textContent = item.second_option_name || 'N/A'; 
                    row.insertCell().textContent = item.distance_2 !== null ? item.distance_2 : 'N/A'; 
                    row.insertCell().textContent = item.third_option_name || 'N/A'; 
                    row.insertCell().textContent = item.distance_3 !== null ? item.distance_3 : 'N/A'; 
                });
            }

        } catch (error) {
            console.error('Error fetching data (pastikan API mengembalikan JSON valid):', error); 
            loadingMessage.textContent = 'Gagal memuat data pendaftar. Silakan coba lagi nanti.';
            loadingMessage.style.color = 'red';
            schoolSummaryLoading.style.display = 'none';
            noSummaryData.textContent = 'Gagal memuat rekapitulasi.';
            noSummaryData.style.display = 'block';
            originSchoolFilter.innerHTML = '<option value="ALL_SCHOOLS" selected>Gagal memuat Asal Sekolah</option>';
            originSchoolFilter.disabled = true;
            // Pastikan pesan error kuota juga muncul jika fetch data utama gagal
            quotaLoading.style.display = 'none';
            noQuotaData.textContent = 'Gagal memuat data kuota.';
            noQuotaData.style.display = 'block';

        } finally {
            // Selalu panggil fungsi kuota setelah data utama selesai di-fetch atau error
            fetchAndDisplayQuotaData(npsn); 
        }
    }

    // Fungsi bantu untuk memuat ulang data dengan parameter saat ini
    function reloadData() {
        const selectedNPSN = schoolFilter.value; 
        const selectedOptionType = optionTypeFilter.value;
        const selectedOriginSchool = originSchoolFilter.value; 
        const searchQuery = searchInput.value;
        const minDistance = minDistanceInput.value;
        const maxDistance = maxDistanceInput.value;
        fetchData(selectedNPSN, selectedOptionType, selectedOriginSchool, searchQuery, minDistance, maxDistance); 
    }

    applyFiltersButton.addEventListener('click', reloadData);

    clearFiltersButton.addEventListener('click', () => {
        cadisdikFilter.value = ""; 
        schoolFilter.innerHTML = '<option value="" disabled selected>Silakan pilih Cabang Dinas/Wilayah dahulu</option>'; 
        schoolFilter.disabled = true;
        optionTypeFilter.value = "DOMISILI"; 
        originSchoolFilter.innerHTML = '<option value="ALL_SCHOOLS" selected>Semua Asal Sekolah</option>'; 
        originSchoolFilter.disabled = true; 
        searchInput.value = '';
        minDistanceInput.value = '';
        maxDistanceInput.value = '';
        reloadData(); 
    });

    cadisdikFilter.addEventListener('change', () => {
        const selectedCadisdikId = cadisdikFilter.value;
        populateSchoolFilter(selectedCadisdikId).then(() => { 
            optionTypeFilter.value = "DOMISILI"; 
            originSchoolFilter.innerHTML = '<option value="ALL_SCHOOLS" selected>Semua Asal Sekolah</option>'; 
            originSchoolFilter.disabled = true;
            searchInput.value = ''; 
            minDistanceInput.value = '';
            maxDistanceInput.value = '';
            reloadData(); 
        });
    });

    schoolFilter.addEventListener('change', () => {
        optionTypeFilter.value = "DOMISILI"; 
        originSchoolFilter.innerHTML = '<option value="ALL_SCHOOLS" selected>Semua Asal Sekolah</option>'; 
        originSchoolFilter.disabled = true;
        searchInput.value = '';
        minDistanceInput.value = '';
        maxDistanceInput.value = '';
        reloadData();
    });

    optionTypeFilter.addEventListener('change', () => {
        originSchoolFilter.innerHTML = '<option value="ALL_SCHOOLS" selected>Semua Asal Sekolah</option>'; 
        originSchoolFilter.disabled = true;
        searchInput.value = '';
        minDistanceInput.value = '';
        maxDistanceInput.value = '';
        reloadData();
    });

    originSchoolFilter.addEventListener('change', reloadData);

    searchInput.addEventListener('input', reloadData);

    // Initial load: Hanya tampilkan pesan instruksi
    reloadData(); 
});