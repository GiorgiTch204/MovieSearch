// კოდში ინტეგრირებულია რეგისტრაციის, ავტორიზაციის, პაროლების შედარებისა და ტოკენების მართვის ლოგიკა, 
// რაც თქვენს პროექტს სრულფასოვან სისტემად აქცევს.

// ფუნქციონალური აღწერა
// მოცემული კოდი წარმოადგენს ვებ-აპლიკაციის კლიენტური მხარის (Frontend) მთავარ ლოგიკას. 
// მისი ფუნქციონალი იყოფა სამ ძირითად ბლოკად:

// ავტორიზაციის მართვა: სისტემა რეგულარულად ამოწმებს localStorage-ში JWT ტოკენის არსებობას. 
// თუ მომხმარებელი შესულია სისტემაში, 
// ნავიგაციის ზოლი დინამიურად იცვლება (ქრება "შესვლა/რეგისტრაცია" და ჩნდება მომხმარებლის სახელი, ისტორიის ნახვისა და გასვლის ღილაკები).

// უსაფრთხო რეგისტრაცია და ლოგინი: * რეგისტრაციისას კოდი ადარებს ორ პაროლს ერთმანეთს და შეუსაბამობის შემთხვევაში აჩერებს პროცესს.

// წარმატებული ავტორიზაციის შემდეგ, სერვერიდან მიღებული წვდომის ტოკენი უსაფრთხოდ ინახება ბრაუზერში.

// სემანტიკური ძებნა: 
// ძიების ფუნქცია გაფართოებულია — იგი ყოველ მოთხოვნაზე აგზავნის მომხმარებლის ტოკენს Authorization ჰედერით,
// რაც ბექენდს საშუალებას აძლევს, თითოეული ძიება კონკრეტული მომხმარებლის ისტორიაში ჩაწეროს.



// --- კონსტანტები და API მისამართები ---
const API_URL = "http://127.0.0.1:8000";

// --- გვერდის ჩატვირთვისას შესასრულებელი მოქმედებები ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    setupEventListeners();
});

// 1. ავტორიზაციის სტატუსის შემოწმება და UI-ს განახლება
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const authSection = document.getElementById('authSection');

    if (token && authSection) {
        // თუ მომხმარებელი ავტორიზებულია, ვცვლით ნავიგაციის ღილაკებს
        authSection.innerHTML = `
            <div class="flex items-center gap-4">
                <span class="text-blue-400 text-sm font-medium">გამარჯობა!</span>
                <button onclick="viewHistory()" class="text-gray-300 hover:text-white text-sm transition">ისტორია</button>
                <button onclick="logout()" class="bg-gray-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition">გასვლა</button>
            </div>
        `;
    }
}

// 2. რეგისტრაციის დამუშავება
async function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const errorText = document.getElementById('passwordError');

    // პაროლების ვალიდაცია
    if (password !== confirmPassword) {
        errorText.classList.remove('hidden');
        return;
    }
    errorText.classList.add('hidden');

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        if (response.ok) {
            alert('რეგისტრაცია წარმატებულია!');
            window.location.href = 'login.html';

            console.log("Pressed")
        } else {
            const err = await response.json();
            alert(`შეცდომა: ${err.detail}`);
        }
    } catch (error) {
        console.error('Registration error:', error);
    }
}

// 3. სისტემაში შესვლა (Login)
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        // FastAPI ტოკენის მისაღებად იყენებს Form Data-ს
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const response = await fetch(`${API_URL}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.access_token);
            window.location.href = 'index.html';
        } else {
            alert('არასწორი სახელი ან პაროლი');
        }
    } catch (error) {
        console.error('Login error:', error);
    }
}

// 4. ფილმების სემანტიკური ძებნა
async function searchMovies() {
    const query = document.getElementById('queryInput').value;
    const grid = document.getElementById('resultsGrid');
    const loader = document.getElementById('loader');
    const token = localStorage.getItem('token');

    if (!query) return;

    grid.innerHTML = '';
    loader.classList.remove('hidden');

    try {
        // მოთხოვნაში ვამატებთ Authorization ჰედერს
        const response = await fetch(`${API_URL}/search?query=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            alert('გთხოვთ გაიაროთ ავტორიზაცია ძებნისთვის');
            window.location.href = 'login.html';
            return;
        }

        const data = await response.json();
        loader.classList.add('hidden');

        if (data.results && data.results.length > 0) {
            data.results.forEach(movie => {
                const card = document.createElement('div');
                card.className = "movie-card bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg transition-all duration-300";
                card.innerHTML = `
                    <h3 class="text-xl font-bold mb-2 text-white">${movie.title}</h3>
                    <p class="text-gray-400 text-sm line-clamp-3 mb-4">${movie.overview}</p>
                    <div class="flex items-center justify-between border-t border-gray-700 pt-4">
                        <span class="text-blue-400 text-xs font-bold uppercase tracking-wider">Match Score</span>
                        <span class="bg-blue-900/30 text-blue-400 px-2 py-1 rounded text-xs">${Math.round(movie.score * 100)}%</span>
                    </div>
                `;
                grid.appendChild(card);
            });
        } else {
            grid.innerHTML = '<p class="col-span-full text-gray-500 py-10">შესაბამისი ფილმები ვერ მოიძებნა.</p>';
        }
    } catch (error) {
        loader.classList.add('hidden');
        console.error('Search error:', error);
    }
}

// 5. დამხმარე ფუნქციები
function logout() {
    localStorage.removeItem('token');
    window.location.reload();
}

function setupEventListeners() {
    // Enter-ზე ძებნა
    const queryInput = document.getElementById('queryInput');
    if (queryInput) {
        queryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchMovies();
        });
    }

    // ფორმების მიბმა
    const regForm = document.getElementById('registerForm');
    if (regForm) regForm.addEventListener('submit', handleRegister);

    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
}