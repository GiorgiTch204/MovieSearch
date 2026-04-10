async function searchMovies(){
    const query=document.getElementById("query").value;
    const resultsList=document.getElementById("results");
    const loading=document.getElementById("loading");

    if(!query){
        return alert("Please enter a description!");
    }

    loading.classList.remove("hidden");
    resultsList.innerHTML="";

    try{
        const response = await fetch(`http://127.0.0.1:8000/search?query=${encodeURIComponent(query)}`);
        const data=await response.json();
        
        loading.classList.add("hidden");

        if(data.results.length>0){
            data.results.forEach(movie => {
                const li=document.createElement("li");
                li.textContent=movie;
                resultsList.appendChild(li);
            });
        } else {
            resultsList.innerHTML="<li>No movies found. Try different description.</li>";
        }
    } catch(error){
        console.error("Error:", error);
        loading.innerHTML="Error connecting to server. Please try again later.";
    }
}

document.getElementById("query").addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    searchMovies();
  }
});