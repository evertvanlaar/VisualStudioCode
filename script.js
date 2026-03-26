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
const installBanner = document.getElementById('install-banner');
const installBtn = document.getElementById('custom-install-button');
const closeBtn = document.getElementById('close-banner');

window.addEventListener('beforeinstallprompt', (e) => {
    // Voorkom dat Chrome de standaard banner toont
    e.preventDefault();
    // Sla het event op
    deferredPrompt = e;
    
    // Toon onze eigen banner
    installBanner.style.display = 'block';
});

// Als er op de 'Install App' knop wordt geklikt
installBtn.addEventListener('click', () => {
    if (deferredPrompt) {
        // Toon de echte installatie-prompt
        deferredPrompt.prompt();
        
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('Gebruiker heeft de app geïnstalleerd');
                installBanner.style.display = 'none';
            }
            deferredPrompt = null;
        });
    }
});

// Gebruiker kan de banner wegklikken
closeBtn.addEventListener('click', () => {
    installBanner.style.display = 'none';
});

// Verberg banner als de app al geïnstalleerd is
window.addEventListener('appinstalled', () => {
    installBanner.style.display = 'none';
    deferredPrompt = null;
});

// --- OFFLINE DETECTION ---

function updateOnlineStatus() {
    const offlineIndicator = document.getElementById('offline-indicator');
    
    if (navigator.onLine) {
        console.log("Status: Online");
        document.body.classList.remove('is-offline');
        if (offlineIndicator) offlineIndicator.style.display = 'none';
        
        // Alleen syncen als we daadwerkelijk van offline naar online gaan
        // om oneindige loops te voorkomen
    } else {
        console.log("Status: Offline");
        document.body.classList.add('is-offline');
        if (offlineIndicator) offlineIndicator.style.display = 'block';
    }
}

// Luister naar veranderingen
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// CRUCIAAL: Voer de check direct uit zodra het script laadt
updateOnlineStatus();