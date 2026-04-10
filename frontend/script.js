//function to handle the movie search logic
async function searchMovies(){

    //get the text value from the search input field
    const query = document.getElementById("query").value;

    //get the html element where the list of movies will be displayed
    const resultsList = document.getElementById("results");

    //get the element that shows the loading status
    const loading = document.getElementById("loading");

    //check if the input is empty and alert the user
    if(!query){
        return alert("Please enter a description!");
    }

    //remove the hidden class to show the loading message
    loading.classList.remove("hidden");

    //clear any movie titles from the previous search
    resultsList.innerHTML = "";

    try {
        //send a get request to the fastapi server
        const response = await fetch(`http://127.0.0.1:8000/search?query=${encodeURIComponent(query)}`);

        //parse the json data from the response
        const data = await response.json();
        
        //hide the loading message
        loading.classList.add("hidden");

        //check if results array has movie titles
        if(data.results.length > 0){

            //loop through each movie title in the results
            data.results.forEach(movie => {

                //create a new li element
                const li = document.createElement("li");

                //set the text content to the movie title
                li.textContent = movie;

                //add the li to the results list
                resultsList.appendChild(li);
            });

        } else {
            //show message if no movies were found
            resultsList.innerHTML = "<li>No movies found. Try different description.</li>";
        }

    } catch(error) {
        //log the error to the console
        console.error("Error:", error);

        //inform the user about the connection error
        loading.innerHTML = "Error connecting to server. Please try again later.";
    }
}

//listen for keys pressed in the search box
document.getElementById("query").addEventListener("keypress", function(event) {

  //trigger search if the enter key is pressed
  if (event.key === "Enter") {
    searchMovies();
  }
});