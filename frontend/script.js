// ეს კოდი განსაზღვრავს ასინქრონულ ფუნქციას, 
// რომელიც პასუხისმგებელია ფილმების ძიების პროცესის მართვაზე. 
// ფუნქცია დაწერილია async ფორმატში, რადგან საჭიროა დაელოდოს backend API-ს პასუხს,
// რადგან fetch ფუნქცია მუშაობს ასინქრონულად.
// ფუნქციის შიგნით პირველად იღება მომხმარებლის მიერ შეყვანილი ტექსტი input ველიდან, 
// რომელსაც აქვს id "query". ეს ტექსტი საჭიროა იმისთვის, რომ გადაეგზავნოს backend-ს როგორც საძიებო მოთხოვნა. 
// შემდეგ ხდება იმ HTML ელემენტის მიღება, სადაც შედეგები უნდა გამოჩნდეს, id "results"-ის გამოყენებით,
//  რათა შესაძლებელი იყოს ფილმების სახელების დინამიურად დამატება.
//  ასევე მიიღება loading ელემენტი id "loading"-ით, რომელიც გამოიყენება მომხმარებლისთვის იმის საჩვენებლად, რომ მოთხოვნა მუშავდება.

// ფუნქცია ამოწმებს, არის თუ არა მომხმარებლის შეყვანა ცარიელი. 
// ეს კეთდება იმისთვის, რომ არ გაიგზავნოს ცარიელი მოთხოვნა სერვერზე.
// თუ ველი ცარიელია, გამოჩნდება შეტყობინება და ფუნქცია შეწყდება. 
// თუ მოთხოვნა ვალიდურია, loading ელემენტიდან იშლება "hidden" კლასი, 
// რათა გამოჩნდეს დატვირთვის შეტყობინება.
// ამავე დროს, წინა ძიების შედეგები იშლება results სიიდან, რათა ახალი შედეგები არ აირიოს ძველებთან.

// შემდეგ გამოიყენება try ბლოკი, 
// სადაც იგზავნება GET მოთხოვნა FastAPI სერვერზე fetch ფუნქციის საშუალებით. 
// მოთხოვნაში query პარამეტრი გადაეცემა URL-ში, 
// ხოლო encodeURIComponent გამოიყენება იმისთვის, 
// რომ ტექსტი უსაფრთხოდ გადაიქცეს URL ფორმატში და სპეციალურმა სიმბოლოებმა არ გამოიწვიოს შეცდომა.
// პასუხის მიღების შემდეგ, ის გარდაიქმნება JSON ფორმატში, რათა JavaScript-მა შეძლოს მისი გამოყენება.

// ამის შემდეგ loading ელემენტს ისევ ემატება "hidden" კლასი, რათა დამალოს დატვირთვის შეტყობინება. 
// შემდეგ ხდება შემოწმება, შეიცავს თუ არა პასუხი შედეგებს. 
// თუ შედეგები არსებობს, თითოეული ფილმის სახელი გადის ციკლში, იქმნება ახალი li ელემენტი, 
// მას ენიჭება ტექსტი და ემატება results სიას, რათა გამოჩნდეს გვერდზე. თუ შედეგები არ მოიძებნა, მომხმარებელს ეჩვენება შესაბამისი შეტყობინება.

// თუ პროცესის დროს რაიმე შეცდომა მოხდა, 
// catch ბლოკში ხდება შეცდომის დაბეჭდვა კონსოლში, 
// რაც ეხმარება დეველოპერს დიაგნოსტიკაში, 
// ხოლო მომხმარებელს ეჩვენება შეტყობინება, რომ სერვერთან დაკავშირება ვერ მოხერხდა.

// ბოლოს, კოდი ამატებს event listener-ს input ველზე, 
// რომელიც უსმენს კლავიატურის ღილაკების დაჭერას. 
// თუ მომხმარებელი დააჭერს Enter ღილაკს, ავტომატურად გამოიძახება searchMovies ფუნქცია, 
// რაც უზრუნველყოფს ძიების სწრაფ და მოსახერხებელ განხორციელებას.



// I define an async function that will handle the movie search process.
// I use async because I need to wait for the API response (fetch is asynchronous).
async function searchMovies(){

    // I get the value entered by the user in the input field with id "query".
    // I need this because it is the search text that will be sent to the backend.
    const query = document.getElementById("query").value;

    // I get the HTML element where I will display the movie results.
    // I need this so I can dynamically insert the results into the page.
    const resultsList = document.getElementById("results");

    // I get the loading element that shows a loading message.
    // I need this to give feedback to the user while waiting for the server response.
    const loading = document.getElementById("loading");

    // I check if the user input is empty.
    // I do this to prevent sending empty requests to the server.
    if(!query){
        return alert("Please enter a description!");
    }

    // I remove the "hidden" class from the loading element.
    // I do this to show the loading message while the request is being processed.
    loading.classList.remove("hidden");

    // I clear any previous search results.
    // I do this so new results don’t mix with old ones.
    resultsList.innerHTML = "";

    try {
        // I send a GET request to my FastAPI backend with the user query.
        // I use encodeURIComponent to safely include the query in the URL.
        const response = await fetch(`http://127.0.0.1:8000/search?query=${encodeURIComponent(query)}`);

        // I convert the response into JSON format.
        // I need this because the backend sends data as JSON.
        const data = await response.json();
        
        // I hide the loading message after receiving the response.
        // I do this to indicate that the process is complete.
        loading.classList.add("hidden");

        // I check if the response contains any movie results.
        // I do this to decide whether to display results or a fallback message.
        if(data.results.length > 0){

            // I loop through each movie title in the results array.
            // I do this to create a list item for each movie.
            data.results.forEach(movie => {

                // I create a new <li> element.
                // I need this to display each movie as a list item.
                const li = document.createElement("li");

                // I set the text of the list item to the movie title.
                // I do this so the user can see the movie name.
                li.textContent = movie;

                // I append the list item to the results list.
                // I do this to render it on the page.
                resultsList.appendChild(li);
            });

        } else {
            // I display a message if no movies were found.
            // I do this to inform the user that the search returned no results.
            resultsList.innerHTML = "<li>No movies found. Try different description.</li>";
        }

    } catch(error) {
        // I log the error in the console.
        // I do this for debugging purposes.
        console.error("Error:", error);

        // I update the loading element with an error message.
        // I do this to inform the user that something went wrong.
        loading.innerHTML = "Error connecting to server. Please try again later.";
    }
}

// I add an event listener to the input field.
document.getElementById("query").addEventListener("keypress", function(event) {

  // I check if the pressed key is "Enter".
  // I do this to trigger the search when the user presses Enter.
  if (event.key === "Enter") {
    searchMovies();
  }
});