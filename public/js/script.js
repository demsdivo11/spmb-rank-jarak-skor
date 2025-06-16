document.addEventListener('DOMContentLoaded', function() {
    const cadisdikFilter = document.getElementById('cadisdikFilter'); // PERUBAHAN ID
    const schoolFilter = document.getElementById('schoolFilter');
    const optionTypeFilter = document.getElementById('optionTypeFilter');
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

    // --- Fungsi untuk mengisi dropdown sekolah ---
    async function populateSchoolFilter(cadisdikId) { // Menerima cadisdikId
        schoolFilter.innerHTML = '<option value="" disabled selected>Memuat sekolah...</option>';
        schoolFilter.disabled = true;

        if (!cadisdikId) { // Jika tidak ada Cadisdik dipilih
            schoolFilter.innerHTML = '<option value="" disabled selected>Pilih Cabang Dinas/Wilayah dahulu</option>';
            return;
        }

        try {
            // Panggil API schools dengan parameter cadisdik_id
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


    // Fungsi untuk menghitung rekapitulasi asal sekolah (Tidak Berubah)
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


    async function fetchData(npsn, optionType, searchQuery = '', minDistance = '', maxDistance = '') {
        loadingMessage.style.display = 'none';
        noDataMessage.style.display = 'none';
        schoolSummaryLoading.style.display = 'none';
        noSummaryData.style.display = 'none';

        dataTableBody.innerHTML = ''; 
        schoolSummaryTableBody.innerHTML = ''; 

        // Menggunakan cadisdikFilter.value untuk validasi
        if (!cadisdikFilter.value || !npsn || !optionType) {
            loadingMessage.textContent = 'Silakan pilih Cabang Dinas/Wilayah, Sekolah Tujuan, dan Jenis Pendaftaran.';
            loadingMessage.style.display = 'block';
            noDataMessage.style.display = 'block'; 
            noSummaryData.style.display = 'block'; 
            return;
        }

        loadingMessage.textContent = 'Memuat data pendaftar... Mohon tunggu sebentar.';
        loadingMessage.style.display = 'block';
        schoolSummaryLoading.textContent = 'Memuat rekapitulasi...';
        schoolSummaryLoading.style.display = 'block';

        try {
            const params = new URLSearchParams();
            params.append('npsn', npsn); 
            params.append('option_type', optionType); 
            if (searchQuery) params.append('search', searchQuery);
            if (minDistance) params.append('min_distance', minDistance);
            if (maxDistance) params.append('max_distance', maxDistance);

            const response = await fetch(`/api/data?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            loadingMessage.style.display = 'none';
            schoolSummaryLoading.style.display = 'none'; 

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
            console.error('Error fetching data:', error);
            loadingMessage.textContent = 'Gagal memuat data pendaftar. Silakan coba lagi nanti.';
            loadingMessage.style.color = 'red';
            schoolSummaryLoading.style.display = 'none';
            noSummaryData.textContent = 'Gagal memuat rekapitulasi.';
            noSummaryData.style.display = 'block';
        }
    }

    // Fungsi bantu untuk memuat ulang data dengan parameter saat ini
    function reloadData() {
        const selectedNPSN = schoolFilter.value; 
        const selectedOptionType = optionTypeFilter.value;
        const searchQuery = searchInput.value;
        const minDistance = minDistanceInput.value;
        const maxDistance = maxDistanceInput.value;
        fetchData(selectedNPSN, selectedOptionType, searchQuery, minDistance, maxDistance);
    }

    applyFiltersButton.addEventListener('click', reloadData);

    // --- Mengatur ulang semua filter dan memuat ulang pesan instruksi ---
    clearFiltersButton.addEventListener('click', () => {
        cadisdikFilter.value = ""; // Reset ke opsi "Pilih Cadisdik"
        schoolFilter.innerHTML = '<option value="" disabled selected>Silakan pilih Cabang Dinas/Wilayah dahulu</option>'; 
        schoolFilter.disabled = true;
        optionTypeFilter.value = "DOMISILI"; // DEFAULT DOMISILI
        searchInput.value = '';
        minDistanceInput.value = '';
        maxDistanceInput.value = '';
        reloadData(); 
    });

    // Event listener untuk perubahan dropdown Cadisdik
    cadisdikFilter.addEventListener('change', () => {
        const selectedCadisdikId = cadisdikFilter.value;
        populateSchoolFilter(selectedCadisdikId).then(() => { 
            optionTypeFilter.value = "DOMISILI"; // DEFAULT DOMISILI
            searchInput.value = ''; 
            minDistanceInput.value = '';
            maxDistanceInput.value = '';
            reloadData(); 
        });
    });

    // Event listener untuk perubahan dropdown Sekolah
    schoolFilter.addEventListener('change', () => {
        optionTypeFilter.value = "DOMISILI"; // DEFAULT DOMISILI
        searchInput.value = '';
        minDistanceInput.value = '';
        maxDistanceInput.value = '';
        reloadData();
    });

    // Event listener untuk perubahan dropdown Jenis Pendaftaran
    optionTypeFilter.addEventListener('change', () => {
        searchInput.value = '';
        minDistanceInput.value = '';
        maxDistanceInput.value = '';
        reloadData();
    });

    searchInput.addEventListener('input', reloadData);

    // Initial load: Hanya tampilkan pesan instruksi
    reloadData(); 
});