//ეს კოდი უზრუნველყოფს ფილმების სემანტიკური ძიების ინტერფეისის 
//მუშაობას: იგი ასინქრონულად უკავშირდება FastAPI ბექენდს,
//მომხმარებლის მიერ შეყვანილ ტექსტს უსაფრთხოდ აგზავნის სერვერზე 
//და მიღებულ მონაცემებს (სათაურს, აღწერას და AI-ს მიერ გამოთვლილ მსგავსების პროცენტს)
// დინამიურად გარდაქმნის თანამედროვე დიზაინის მქონე ბარათებად. 
//ფუნქციონალი მოიცავს ძიების პროცესის ვიზუალურ ინდიკატორს 
//(Loader), წინა შედეგების ავტომატურ გასუფთავებას, 
//შეცდომების მართვას და საშუალებას იძლევა ძიება 
//განხორციელდეს როგორც ღილაკზე დაჭერით, 
//ისე "Enter" კლავიშის გამოყენებით.


// ეს კოდი განსაზღვრავს ასინქრონულ ფუნქციას, რომელიც მართავს ფილმების ძიების პროცესს.
// ფუნქცია იყენებს async/await სინტაქსს, რათა ეფექტურად დაელოდოს backend API-ს პასუხს.
async function searchMovies() {
    // მომხმარებლის მიერ შეყვანილი ტექსტის მიღება input ველიდან.
    const query = document.getElementById('queryInput').value;
    // იმ HTML ელემენტის მიღება (Grid), სადაც ფილმების ბარათები უნდა ჩაიხატოს.
    const grid = document.getElementById('resultsGrid');
    // loading ინდიკატორის მიღება მომხმარებლისთვის პროცესის საჩვენებლად.
    const loader = document.getElementById('loader');

    // ვამოწმებთ, არის თუ არა შეყვანილი ტექსტი ცარიელი, რათა თავიდან ავიცილოთ ფუჭი მოთხოვნები.
    if (!query) return;

    // ძველი შედეგების გასუფთავება და ჩატვირთვის ინდიკატორის გამოჩენა.
    grid.innerHTML = '';
    loader.classList.remove('hidden');

    try {
        // GET მოთხოვნის გაგზავნა FastAPI სერვერზე. 
        // encodeURIComponent უზრუნველყოფს საძიებო ტექსტის უსაფრთხო ფორმატში გადაყვანას URL-ისთვის.
        const response = await fetch(`http://127.0.0.1:8000/search?query=${encodeURIComponent(query)}`);
        // სერვერიდან მიღებული პასუხის გარდაქმნა JSON ფორმატში.
        const data = await response.json();

        // მონაცემების მიღების შემდეგ ვმალავთ ჩატვირთვის ინდიკატორს.
        loader.classList.add('hidden');

        // ვამოწმებთ, გვაქვს თუ არა ძიების შედეგები.
        if (data.results && data.results.length > 0) {
            // თითოეული ნაპოვნი ფილმისთვის ვქმნით ახალ "ბარათს".
            data.results.forEach(movie => {
                const card = document.createElement('div');
                // Tailwind CSS-ის კლასების მინიჭება ბარათის თანამედროვე ვიზუალისთვის.
                card.className = "movie-card bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg";
                
                // ბარათის შიდა სტრუქტურის შევსება: სათაური, აღწერა და სემანტიკური ქულა.
                card.innerHTML = `
                    <h3 class="text-xl font-bold mb-2 text-white">${movie.title}</h3>
                    <p class="text-gray-400 text-sm line-clamp-3">${movie.overview}</p>
                    <div class="mt-4 flex items-center justify-between text-xs text-blue-400 font-semibold">
                        <span>Semantic Match: ${Math.round(movie.score * 100)}%</span>
                    </div>
                `;
                // შექმნილი ბარათის დამატება მთავარ კონტეინერში.
                grid.appendChild(card);
            });
        } else {
            // თუ შედეგები არ არის, მომხმარებელს ვუჩვენებთ შესაბამის შეტყობინებას.
            grid.innerHTML = '<p class="col-span-full text-gray-500">შედეგი ვერ მოიძებნა.</p>';
        }
    } catch (error) {
        // შეცდომის შემთხვევაში ვმალავთ ლოუდერს და გამოგვაქვს გაფრთხილება.
        loader.classList.add('hidden');
        console.error('Error:', error);
        alert('სერვერთან კავშირი ვერ დამყარდა.');
    }
}

// Event Listener-ის დამატება input ველზე, რათა ძიება დაიწყოს "Enter" ღილაკზე დაჭერისას.
document.getElementById('queryInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        searchMovies();
    }
});