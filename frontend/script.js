async function searchMovies() {
    const query = document.getElementById('queryInput').value.trim();
    const grid = document.getElementById('resultsGrid');
    const loader = document.getElementById('loader');

    if (!query) return;

    grid.innerHTML = '';
    loader.classList.remove('hidden');

    try {
        const response = await fetch(`http://127.0.0.1:8000/search?query=${encodeURIComponent(query)}`);
        const data = await response.json();

        loader.classList.add('hidden');

        if (data.results && data.results.length > 0) {
            data.results.forEach(movie => {
                const card = document.createElement('div');
                card.className = "movie-card bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg";
                
                card.innerHTML = `
                    <h3 class="text-xl font-bold mb-2 text-white">${movie.title}</h3>
                    <p class="text-gray-400 text-sm line-clamp-3">${movie.overview}</p>
                `;
                grid.appendChild(card);
            });
        } else {
            grid.innerHTML = '<p class="col-span-full text-gray-500">შედეგი ვერ მოიძებნა.</p>';
        }
    } catch (error) {
        loader.classList.add('hidden');
        console.error('Error:', error);
        alert('სერვერთან კავშირი ვერ დამყარდა.');
    }
}

document.getElementById('queryInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        searchMovies();
    }
});