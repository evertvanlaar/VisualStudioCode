// script.js

// 1. Zorg dat we altijd weten welke filters actief zijn
let activeCategory = 'all';
let activeLocation = 'all';
let allBusinesses = []; // Hierin sla je de data uit Google Sheets op

// 2. De hoofdfunctie die alles combineert
function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();

    const filtered = allBusinesses.filter(biz => {
        // Alleen goedgekeurde submissions tonen
        if (biz.Status.toLowerCase() !== 'active') return false;

        const matchesCat = (activeCategory === 'all' || biz.Category === activeCategory);
        const matchesLoc = (activeLocation === 'all' || biz.Location === activeLocation);
        
        // Zoeken op naam óf categorie
        const matchesSearch = searchTerm === '' || 
                              biz.Name.toLowerCase().includes(searchTerm) || 
                              biz.Category.toLowerCase().includes(searchTerm);

        // De ondernemer moet aan alle 3 de eisen voldoen
        return matchesCat && matchesLoc && matchesSearch;
    });

    displayBusinesses(filtered);
}

// 3. Functie om de knoppen dynamisch te maken
function setupFilterButtons(data) {
    // Haal de unieke categorieën en locaties op uit je data
    const categories = ['all', ...new Set(data.map(item => item.Category))];
    const locations = ['all', ...new Set(data.map(item => item.Location))];

    // Categorie-knoppen genereren
    const catContainer = document.getElementById('filter-buttons');
    catContainer.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        btn.className = 'filter-btn'; // Zorg voor CSS styling
        btn.onclick = () => {
            activeCategory = cat;
            applyFilters();
        };
        catContainer.appendChild(btn);
    });

    // Locatie-knoppen genereren
    const locContainer = document.getElementById('location-buttons');
    locContainer.innerHTML = '';
    locations.forEach(loc => {
        const btn = document.createElement('button');
        btn.textContent = loc.charAt(0).toUpperCase() + loc.slice(1);
        btn.className = 'location-btn'; // Zorg voor CSS styling
        btn.onclick = () => {
            activeLocation = loc;
            applyFilters();
        };
        locContainer.appendChild(btn);
    });
}

// 4. Luister naar de zoekbalk
document.getElementById('search-input').addEventListener('input', applyFilters);

// 5. De data ophalen (wanneer de pagina laadt)
// allBusinesses = fetchDataFromGoogleSheets(); // Hier moet jouw ophaal-functie komen
// setupFilterButtons(allBusinesses);

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  // Voorkom dat de standaard banner direct verschijnt
  e.preventDefault();
  // Sla het event op zodat we het later kunnen triggeren
  deferredPrompt = e;
  
  // Toon hier je eigen installatie-knop (bijv. een verborgen div in je menu)
  const installBtn = document.getElementById('custom-install-button');
  if (installBtn) {
    installBtn.style.display = 'block';
    
    installBtn.addEventListener('click', () => {
      // Toon de echte Chrome installatie-prompt
      deferredPrompt.prompt();
      // Wacht op de keuze van de gebruiker
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        deferredPrompt = null;
      });
    });
  }
});