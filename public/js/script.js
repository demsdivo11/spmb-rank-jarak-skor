document.addEventListener('DOMContentLoaded', function() {
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

    // Elemen baru untuk rekapitulasi asal sekolah
    const schoolSummaryTableBody = document.querySelector('#schoolSummaryTable tbody');
    const schoolSummaryLoading = document.getElementById('schoolSummaryLoading');
    const noSummaryData = document.getElementById('noSummaryData');


    // Fungsi untuk menghitung rekapitulasi asal sekolah
    function generateSchoolSummary(data) {
        const schoolCounts = {};
        let totalPendaftar = 0;

        data.forEach(item => {
            const schoolName = item.school_name || 'Tidak Diketahui';
            schoolCounts[schoolName] = (schoolCounts[schoolName] || 0) + 1;
            totalPendaftar++;
        });

        // Urutkan berdasarkan jumlah pendaftar (tertinggi duluan)
        const sortedSchools = Object.entries(schoolCounts).sort(([, countA], [, countB]) => countB - countA);

        schoolSummaryTableBody.innerHTML = ''; // Bersihkan tabel rekapitulasi
        if (sortedSchools.length === 0) {
            noSummaryData.style.display = 'block';
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
        loadingMessage.style.display = 'block';
        noDataMessage.style.display = 'none';
        dataTableBody.innerHTML = ''; 

        schoolSummaryLoading.style.display = 'block'; // Tampilkan loading rekapitulasi
        schoolSummaryTableBody.innerHTML = ''; // Bersihkan rekapitulasi lama
        noSummaryData.style.display = 'none';

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
            schoolSummaryLoading.style.display = 'none'; // Sembunyikan loading rekapitulasi

            if (data.length === 0) {
                noDataMessage.style.display = 'block';
                noSummaryData.style.display = 'block'; // Tampilkan juga pesan no data untuk rekapitulasi
            } else {
                noDataMessage.style.display = 'none';
                generateSchoolSummary(data); // Panggil fungsi rekapitulasi

                data.forEach(item => {
                    const row = dataTableBody.insertRow();
                    row.insertCell().textContent = item.ranking_filtered !== undefined ? item.ranking_filtered : 'N/A';
                    row.insertCell().textContent = item.score !== null ? item.score.toFixed(3) : 'N/A';
                    row.insertCell().textContent = item.registration_number; 
                    
                    // Menampilkan Nama dengan highlight jika ada pencarian
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

    clearFiltersButton.addEventListener('click', () => {
        schoolFilter.value = schoolFilter.options[0].value; 
        optionTypeFilter.value = 'DOMISILI'; 
        searchInput.value = '';
        minDistanceInput.value = '';
        maxDistanceInput.value = '';
        reloadData(); 
    });

    schoolFilter.addEventListener('change', () => {
        optionTypeFilter.value = 'DOMISILI'; 
        searchInput.value = '';
        minDistanceInput.value = '';
        maxDistanceInput.value = '';
        reloadData();
    });

    optionTypeFilter.addEventListener('change', () => {
        searchInput.value = '';
        minDistanceInput.value = '';
        maxDistanceInput.value = '';
        reloadData();
    });

    // Perhatikan event 'input' untuk searchInput agar highlight otomatis
    searchInput.addEventListener('input', reloadData);


    reloadData(); 
});