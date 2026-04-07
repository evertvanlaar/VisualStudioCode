/**
 * app.js - De "hersenen" van de Kala Nera Business Directory
 */

const N8N_WEBHOOK_URL = 'https://n8n.vanlaar.cloud/webhook/local-businesses';
const STORAGE_KEY = 'kalanera_offline_data';

let allBusinesses = []; 
let activeCategory = 'all';
let activeLocation = 'all';
let deferredPrompt; // Global variabele voor PWA

// Icon Map voor categorieën
const iconMap = {
    'Bakery': 'fa-bread-slice', 'Bakker': 'fa-bread-slice', 'Coffee': 'fa-coffee', 'Koffie': 'fa-coffee',
    'Eat': 'fa-utensils', 'Eten': 'fa-utensils', 'Drink': 'fa-glass-cheers', 'Pub': 'fa-beer',
    'Shop': 'fa-shopping-cart', 'Other': 'fa-shopping-bag', 'Supermarket': 'fa-shopping-basket',
    'Sleep': 'fa-bed', 'B&B': 'fa-hotel', 'Camp': 'fa-campground', 'Beauty': 'fa-spa',
    'Kapper': 'fa-cut', 'Sport': 'fa-running', 'Pharmacy': 'fa-pills', 'Garage': 'fa-car'
};

// --- STAP 2: VERSIE-BEHEER (SLECHTS OP 1 PLEK AANPASSEN) ---
const APP_VERSION = '1.0.36'; // <--- Pas VOORTAAN alleen nog maar dit getal aan!
let CURRENT_APP_VERSION = APP_VERSION; 

if ('serviceWorker' in navigator) {
    // We plakken de variabele automatisch achter de URL
    const swUrl = `/service-worker.js?v=${APP_VERSION}`;

    navigator.serviceWorker.register(swUrl)
        .then(reg => {
            console.log(`Service Worker registratie gepusht naar v${APP_VERSION}`);
            reg.update(); 
        });

    navigator.serviceWorker.ready.then(reg => {
        if (!navigator.serviceWorker.controller) return;
        
        const mc = new MessageChannel();
        mc.port1.onmessage = (e) => {
            if (e.data && e.data.version) {
                CURRENT_APP_VERSION = e.data.version;
                console.log("Versie bevestigd door SW:", CURRENT_APP_VERSION);
            }
        };
        navigator.serviceWorker.controller.postMessage({type: 'GET_VERSION'}, [mc.port2]);
    });
}

// --- INITIALISATIE ---
async function init() {
    const businessList = document.getElementById('business-list');
    const cachedData = localStorage.getItem(STORAGE_KEY);
    
    // --- STAP 1: Check op welke pagina we zijn ---
    const isWishlistPage = document.getElementById('empty-wishlist') !== null;

    // Functie om de juiste weergave te kiezen
    const showData = () => {
        if (isWishlistPage) {
            renderWishlist(); // Toon alleen hartjes
        } else {
            renderEverything(); // Toon alles + filters (Home)
        }
    };

    // --- STAP 2: Laad data uit Cache ---
    if (cachedData) {
        try {
            allBusinesses = JSON.parse(cachedData);
            showData(); 
        } catch (e) {
            console.error("Cache corrupt.");
        }
    }

    // --- STAP 3: Haal verse data op via n8n ---
    try {
        const response = await fetch(N8N_WEBHOOK_URL);
        if (response.ok) {
            const rawData = await response.json();
            const freshData = rawData.filter(biz => biz.Status === 'Active');
           
            const now = new Date();
            const timeString = now.toLocaleDateString('nl-NL') + ' ' + now.toLocaleTimeString('nl-NL', {hour: '2-digit', minute:'2-digit'});
            localStorage.setItem('kalanera_last_sync', timeString);

            // --- VOEG DIT HIER TOE VOOR EENMALIGE UITVOER ---
            // exportSitemap(freshData);                                // HIERMEE GENEREER JE EEN ACTUELE STIEMAP.XML
            // ------------------------------------------------

            localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
            allBusinesses = freshData;
            
            showData(); // Update de pagina met verse data
        }
    } catch (error) {
        console.warn("Offline mode.");
    }

    // --- STAP 4: Overige extra's ---
    updateOnlineStatus();
    updateWeather(); // Zorg dat het weer ook geladen wordt
}

// --- UI RENDERING & FILTERS ---
function renderEverything() {
    generateCategoryButtons(allBusinesses);
    generateLocationButtons(allBusinesses);
    renderBusinesses(allBusinesses);
}

function updateOnlineStatus() {
    const offlineIndicator = document.getElementById('offline-indicator');
    
    if (navigator.onLine) {
        // We zijn ONLINE
        document.body.classList.remove('is-offline');
        if (offlineIndicator) offlineIndicator.style.display = 'none';
    } else {
        // We zijn OFFLINE
        document.body.classList.add('is-offline');
        if (offlineIndicator) offlineIndicator.style.display = 'block';
    }
}

// Zorg dat de browser luistert naar veranderingen in de verbinding
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Voer het ook direct uit als de pagina laadt
document.addEventListener('DOMContentLoaded', updateOnlineStatus);

function getIcon(cat) {
    const key = Object.keys(iconMap).find(k => (cat || "").toLowerCase().includes(k.toLowerCase()));
    return `<i class="fa ${key ? iconMap[key] : 'fa-tag'}"></i>`;
}

function getColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
}

function generateCategoryButtons(data) {
    const container = document.getElementById('filter-buttons');
    if (!container) return;
    const categories = [...new Set(data.map(biz => biz.Category).filter(cat => cat))].sort();
    let html = `<button class="filter-btn ${activeCategory === 'all' ? 'active' : ''}" data-category="all"><i class="fa fa-th-large"></i> <span>All</span></button>`;
    categories.forEach(cat => {
        html += `<button class="filter-btn ${activeCategory === cat ? 'active' : ''}" data-category="${cat}">${getIcon(cat)} <span>${cat}</span></button>`;
    });
    container.innerHTML = html;
    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = (e) => {
            const targetBtn = e.target.closest('.filter-btn');
            activeCategory = targetBtn.getAttribute('data-category');
            container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            targetBtn.classList.add('active');
            applyFilters();
        };
    });
}

function generateLocationButtons(data) {
    const container = document.getElementById('location-buttons');
    if (!container) return;
    const locations = [...new Set(data.map(biz => biz.Location).filter(loc => loc))].sort();
    let html = `<button class="filter-btn ${activeLocation === 'all' ? 'active' : ''}" data-location="all"><i class="fa fa-map-marker-alt"></i> <span>All Locations</span></button>`;
    locations.forEach(loc => {
        html += `<button class="filter-btn ${activeLocation === loc ? 'active' : ''}" data-location="${loc}"><span>${loc}</span></button>`;
    });
    container.innerHTML = html;
    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = (e) => {
            const targetBtn = e.target.closest('.filter-btn');
            activeLocation = targetBtn.getAttribute('data-location');
            container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            targetBtn.classList.add('active');
            applyFilters();
        };
    });
}

function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    const filtered = allBusinesses.filter(biz => {
        const matchesSearch = (biz.Name || "").toLowerCase().includes(searchTerm) || 
                              (biz.Category || "").toLowerCase().includes(searchTerm);
        const matchesCategory = activeCategory === 'all' || biz.Category === activeCategory;
        const matchesLocation = activeLocation === 'all' || biz.Location === activeLocation;
        return matchesSearch && matchesCategory && matchesLocation;
    });
    renderBusinesses(filtered);
}

// --- DE HOOFDLIJST RENDEREN ---

function renderBusinesses(data) {
    const container = document.getElementById('business-list');
    if (!container) return;
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="status-msg">No businesses found matching your criteria.</p>';
        return;
    }

    // Veilig de wishlist ophalen
    let wishlist = [];
    try {
        if (typeof getWishlist === 'function') {
            wishlist = getWishlist();
        } else {
            const saved = localStorage.getItem('kalanera_wishlist');
            wishlist = saved ? JSON.parse(saved) : [];
        }
    } catch (e) { wishlist = []; }

    const grouped = data.reduce((acc, biz) => {
        const cat = biz.Category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(biz);
        return acc;
    }, {});

    Object.keys(grouped).sort().forEach(category => {
        const header = document.createElement('div');
        header.className = 'category-section-header';
        header.innerHTML = `<span>${getIcon(category)} ${category} <small>(${grouped[category].length})</small></span>`;
        container.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'business-grid';
        
        grouped[category].sort((a, b) => (a.Name || "").localeCompare(b.Name || "")).forEach(biz => {
            const rawUrl = biz.Website || '';
            const cleanUrl = rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl;
            const displayUrl = rawUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
            const catColor = getColor(category);
            
            const reviewUrl = `https://www.google.com/search?q=${encodeURIComponent(biz.Name + ' Kala Nera reviews')}`;
            const mapsUrl = biz.GoogleMapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.Name + ' Kala Nera')}`;
            const emailHtml = (biz.Email && biz.Email.trim() !== "" && biz.Email !== "-") 
            ? `<a href="mailto:${biz.Email}" class="btn-icon mail-btn" title="E-mail"><i class="fa fa-envelope"></i></a>` 
            : '';

            const isFavorite = wishlist.includes(biz.Name);
            // let finalImageUrl = biz.PhotoURL || (rawUrl ? `https://s0.wp.com/mshots/v1/${encodeURIComponent(cleanUrl)}?w=180&h=130` : `https://via.placeholder.com/180x130?text=${encodeURIComponent(biz.Name)}`);
            // Gebruik de PhotoURL als die er is, anders een nette placeholder met de naam
            let finalImageUrl = biz.PhotoURL || `https://via.placeholder.com/180x130?text=${encodeURIComponent(biz.Name)}`;

            // 1. Maak de variabele aan (boven grid.innerHTML)
            const webHtml = biz.Website && biz.Website.trim() !== "" 
                ? `<a href="${cleanUrl}" target="_blank" class="btn-icon web-btn"><i class="fa fa-globe"></i></a>` 
                : '';

            // 2. Gebruik de variabele in de grid
            grid.innerHTML += `
                <div class="biz-card-mini" style="border-left: 4px solid ${catColor}">
                    <div class="mini-preview">
                        <a href="${cleanUrl}" target="_blank">
                            <img src="${finalImageUrl}" onerror="this.src='https://via.placeholder.com/180x130?text=No+Photo'">
                        </a>
                        <button class="wishlist-btn ${isFavorite ? 'active' : ''}" onclick="toggleWishlist('${biz.Name.replace(/'/g, "\\'")}', this)">
                            <i class="${isFavorite ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                        </button>
                    </div>
                    <div class="mini-content">
                        <div class="mini-row-top">
                            <h2 class="biz-name">${biz.Name}</h2>
                            <span class="biz-location"><i class="fa fa-map-marker-alt"></i> ${biz.Location || 'Kato Gatzea'}</span>
                        </div>
                        
                        <div class="mini-actions">
                            ${(biz.Phone && biz.Phone.trim() !== "" && biz.Phone !== "-") 
                                ? `<div class="phone-group">
                                        <a href="tel:${biz.Phone}" class="btn-icon phone-btn"><i class="fa fa-phone"></i></a>
                                        <span class="phone-txt">${biz.Phone}</span>
                                        <button class="btn-icon copy-btn" onclick="copyToClipboard('${biz.Phone}', this)"><i class="fa fa-copy"></i></button>
                                </div>` 
                                : `<div class="phone-group" style="visibility: hidden;"></div>`
                            }
                            <div class="action-right">
                                ${webHtml}
                                ${emailHtml}
                                <a href="${reviewUrl}" target="_blank" class="btn-icon review-btn"><i class="fa fa-star"></i></a>
                                <a href="${mapsUrl}" target="_blank" class="btn-icon nav-btn-action"><i class="fa fa-location-dot"></i></a>
                            </div>
                        </div>
                    </div>
                </div>`;
        });
        container.appendChild(grid);
    });

    // Sync info
    const lastSync = localStorage.getItem('kalanera_last_sync') || 'Onbekend';
    const syncDiv = document.createElement('div');
    syncDiv.className = 'sync-info';
    syncDiv.innerHTML = `<small style="display:block; text-align:center; margin-top:20px; color:var(--muted); font-size:11px;">Last sync: ${lastSync}</small>`;
    container.appendChild(syncDiv);
    
    // Animatie
    setTimeout(() => {
        document.querySelectorAll('.biz-card-mini').forEach((card, index) => {
            setTimeout(() => { card.classList.add('show'); }, index * 30);
        });
    }, 50);

    // Nadat de kaartjes op het scherm staan:
    updateSchemaOrg(data);
}

function updateSchemaOrg(businesses) {
    const schemaScript = document.getElementById('schema-jsonld');
    if (!schemaScript) return;

    let schemaData = JSON.parse(schemaScript.textContent);

    schemaData.itemListElement = businesses.map((biz, index) => {
        // Mapping van jouw categorieën naar officiële Schema types
        let specificType = "LocalBusiness"; // De veilige standaard
        
        const cat = biz.Category ? biz.Category.toLowerCase() : "";
        
        if (cat.includes("restaurant") || cat.includes("eat") || cat.includes("food")) {
            specificType = "Restaurant";
        } else if (cat.includes("hotel") || cat.includes("room") || cat.includes("sleep")) {
            specificType = "Hotel";
        } else if (cat.includes("shop") || cat.includes("store")) {
            specificType = "Store";
        } else if (cat.includes("drink") || cat.includes("cafe")) {
            specificType = "BarOrPub";
        }

        // Pas dit aan in je updateSchemaOrg functie:
        return {
            "@type": "ListItem",
            "position": index + 1,
            "item": {
                "@type": specificType,
                "name": biz.Name, // Met hoofdletter N
                "description": biz.Category + " in Kala Nera: " + biz.Name,
                "image": biz.PhotoURL || "https://www.kalanera.gr/default-image.jpg",
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": biz.Location || "Kala Nera",
                    "addressRegion": "Pelion",
                    "postalCode": "37010",
                    "addressCountry": "GR"
                }
            }
        };
    });

    schemaScript.textContent = JSON.stringify(schemaData, null, 2);
}

// --- HULPFUNCTIES (Zorg dat deze eronder staan!) ---

function getIcon(cat) {
    if (typeof iconMap === 'undefined') return '<i class="fa fa-tag"></i>';
    const key = Object.keys(iconMap).find(k => (cat || "").toLowerCase().includes(k.toLowerCase()));
    return `<i class="fa ${key ? iconMap[key] : 'fa-tag'}"></i>`;
}

function getColor(str) {
    if (!str) return '#4A6C4A';
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
}

function copyToClipboard(text, el) {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text).then(() => {
        const icon = el.querySelector('i');
        const oldClass = icon.className;
        icon.className = 'fa fa-check';
        setTimeout(() => { icon.className = oldClass; }, 2000);
    });
}

// --- EVENT LISTENERS ---

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// --- GEOPTIMALISEERD PWA INSTALL EVENT ---
window.addEventListener('beforeinstallprompt', (e) => {
    // 1. Altijd blokkeren op desktop (boven 767px)
    if (window.innerWidth > 767) return; 

    // 2. Stop het standaard gedrag en sla het event op
    e.preventDefault();
    deferredPrompt = e;

    // 3. Toon de optie ALTIJD in het menu
    const installItem = document.getElementById('menu-install-item');
    if (installItem) {
        installItem.style.display = 'block';
        installItem.classList.add('show-install');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // 1. Dark Mode
    if (typeof initDarkMode === 'function') {
        initDarkMode();
    }

    // 2. Zoekbalk listener
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', applyFilters);

    // 3. Mobiel menu
    const menu = document.querySelector('#mobile-menu');
    const menuLinks = document.querySelector('#nav-list');
    if (menu && menuLinks) {
        menu.addEventListener('click', () => {
            menuLinks.classList.toggle('active');
            menu.classList.toggle('is-active');
        });
    }

    // 4. Wishlist teller bijwerken
    updateWishlistCount();

    // 5. De data-fetching starten
    init();

    // 6. EXTRA: Google Maps Button logica (optioneel, voor analytics of effect)
    const mapFab = document.querySelector('.map-fab');
    if (mapFab) {
        console.log("Map button is ready");
    }
});



async function updateWeather() {
    const tempEl = document.getElementById('weather-temp');
    const iconEl = document.getElementById('weather-icon');
    if (!tempEl) return;

    try {
        // Coördinaten van Kala Nera
        const lat = 39.30;
        const lon = 23.12;
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();
        
        const temp = Math.round(data.current_weather.temperature);
        const code = data.current_weather.weathercode;

        // Simpele icoon mapping
        let icon = '☀️';
        if (code > 0) icon = '🌤️';
        if (code > 3) icon = '☁️';
        if (code > 60) icon = '🌧️';

        tempEl.innerText = `${temp}°C`;
        iconEl.innerText = icon;
    } catch (e) {
        console.warn("Weer kon niet worden geladen");
        tempEl.style.display = 'none';
    }
}


// --- WISHLIST LOGICA ---

function renderWishlist() {
    const container = document.getElementById('business-list');
    const emptyMsg = document.getElementById('empty-wishlist');
    const clearBtn = document.getElementById('clear-wishlist'); // Pak de knop uit de hero op

    // 1. Haal de namen van je favorieten op uit de browser-opslag
    const saved = localStorage.getItem('kalanera_wishlist');
    const wishlistNames = saved ? JSON.parse(saved) : [];

    // 2. Filter de grote lijst (allBusinesses) op alleen deze namen
    const favoriteBusinesses = allBusinesses.filter(biz => wishlistNames.includes(biz.Name));

    // --- NIEUW: Beheer de "Clear Wishlist" knop ---
    if (clearBtn) {
        // Toon de knop alleen als er echt favorieten zijn
        clearBtn.style.display = favoriteBusinesses.length > 0 ? 'inline-block' : 'none';

        // Voeg de klik-actie toe
        clearBtn.onclick = (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to clear your entire wishlist?")) {
                localStorage.setItem('kalanera_wishlist', JSON.stringify([]));
                // We roepen de functie opnieuw aan om de UI direct te updaten
                renderWishlist();
                // Vergeet niet het hartje in de menubalk ook te updaten
                if (typeof updateWishlistCount === "function") updateWishlistCount();
            }
        };
    }
    // ----------------------------------------------

    // 3. Als de lijst leeg is, toon de "Nog geen favorieten" melding
    if (favoriteBusinesses.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        if (container) container.innerHTML = '';
        return;
    }

    // 4. Als er wel favorieten zijn, verberg de melding en render de kaartjes
    if (emptyMsg) emptyMsg.style.display = 'none';
    
    // We hergebruiken hier je bestaande renderBusinesses functie!
    renderBusinesses(favoriteBusinesses);
}

function updateWishlistCount() {
    const wishlist = getWishlist();
    const count = wishlist.length;
    
    // Zoek het link-element in het menu. 
    // We zoeken specifiek naar de link die naar wishlist.html gaat.
    const wishlistLink = document.querySelector('a[href="wishlist.html"]');
    
    if (wishlistLink) {
        if (count > 0) {
            wishlistLink.innerHTML = `<i class="fa-solid fa-heart menu-heart"></i> Favorites (${count})`;
        } else {
            wishlistLink.innerHTML = `<i class="fa-solid fa-heart menu-heart"></i> Favorites`;
        }
    }
}

/**
 * Beheert het aan/uitzetten van favorieten
 */
function toggleWishlist(name, btn) {
    let saved = localStorage.getItem('kalanera_wishlist');
    let wishlist = saved ? JSON.parse(saved) : [];

    if (wishlist.includes(name)) {
        // Verwijderen uit lijst
        wishlist = wishlist.filter(n => n !== name);
        btn.classList.remove('active');
        const icon = btn.querySelector('i');
        if (icon) icon.className = 'fa-regular fa-heart';
        
        // Als we op de wishlist pagina zijn: haal het kaartje direct weg
        if (document.getElementById('empty-wishlist')) {
            renderWishlist(); 
        }
    } else {
        // Toevoegen aan lijst
        wishlist.push(name);
        btn.classList.add('active');
        const icon = btn.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-heart';
    }

    localStorage.setItem('kalanera_wishlist', JSON.stringify(wishlist));

    // VOEG DEZE REGEL TOE:
    updateWishlistCount();

    if (document.getElementById('empty-wishlist')) renderWishlist();
}

/**
 * Hulpfunctie om de huidige wishlist op te halen
 */
function getWishlist() {
    try {
        const saved = localStorage.getItem('kalanera_wishlist');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
}

// --- VEILIGE DARK MODE INITIALISATIE ---
function initDarkMode() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const body = document.body;
    
    // Als de knop niet op deze pagina staat, stop dan rustig zonder te crashen
    if (!darkModeToggle) {
        // Wel even het thema toepassen als dat al in localStorage staat
        if (localStorage.getItem('theme') === 'dark') {
            body.setAttribute('data-theme', 'dark');
        }
        return;
    }

    const icon = darkModeToggle.querySelector('i');

    // Check opgeslagen thema bij het laden
    if (localStorage.getItem('theme') === 'dark') {
        body.setAttribute('data-theme', 'dark');
        if (icon) icon.classList.replace('fa-moon', 'fa-sun');
    }

    darkModeToggle.addEventListener('click', () => {
        const isDark = body.getAttribute('data-theme') === 'dark';
        
        if (isDark) {
            body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            if (icon) icon.classList.replace('fa-sun', 'fa-moon');
        } else {
            body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            if (icon) icon.classList.replace('fa-moon', 'fa-sun');
        }
    });
}

// Zorg dat deze functie wordt aangeroepen in je DOMContentLoaded event listener (die heb je al staan!)

// --- GEOPTIMALISEERDE INSTALLATIE CODE (VERSIE 1.0.8) ---
(function() {
    let deferredPrompt; // We gebruiken nu één universele naam
    const installItem = document.getElementById('menu-install-item');

    // 1. Luister naar het installatie-event
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log("PWA Installatie event opgevangen.");
        e.preventDefault();
        deferredPrompt = e;
        
        // De CSS regelt de weergave, maar we kunnen de class voor de zekerheid toevoegen
        if (installItem) {
            installItem.classList.add('show-install');
        }
    });

    // 2. De functie die wordt aangeroepen door de HTML (onclick)
    window.triggerManualInstall = async function(event) {
        if (event) event.preventDefault();
        
        console.log("Klik op install-knop. Status event:", deferredPrompt);

        if (!deferredPrompt) {
            // Als er geen event is, is de app waarschijnlijk al geïnstalleerd
            alert("The app is already installed or can be added via the browser-settings.");
            return;
        }

        // Toon de prompt
        deferredPrompt.prompt();

        // Wacht op keuze
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Gebruiker koos: ${outcome}`);

        if (outcome === 'accepted') {
            console.log('Installatie geaccepteerd.');
            // We laten de knop staan (jouw wens), of we halen de class weg:
            // if (installItem) installItem.classList.remove('show-install');
        }

        // Reset het event (verplicht door browser)
        deferredPrompt = null;
    };

    // 3. Luister naar de voltooide installatie
    window.addEventListener('appinstalled', () => {
        console.log('PWA succesvol geïnstalleerd.');
        // Optioneel: verberg knop na installatie
        // if (installItem) installItem.classList.remove('show-install');
    });
})();

// --- STAP 3: VERBERG INSTALLATIE-OPTIE IN DE APP ZELF ---
function checkDisplayMode() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                         || window.navigator.standalone 
                         || document.referrer.includes('android-app://');

    if (isStandalone) {
        console.log("App running in standalone mode. Hide installation-button.");
        const installItem = document.getElementById('menu-install-item');
        if (installItem) {
            // We gebruiken !important om de CSS-force die we eerder maakten te overrulen
            installItem.style.setProperty('display', 'none', 'important');
        }
    }
}

// Voer de check uit zodra de pagina geladen is
window.addEventListener('load', checkDisplayMode);

// Luister ook naar de 'appinstalled' event voor directe feedback
window.addEventListener('appinstalled', () => {
    const installItem = document.getElementById('menu-install-item');
    if (installItem) {
        installItem.style.setProperty('display', 'none', 'important');
    }
});

// Trace app versie, OS, Device, Scherm, Referrer, Theme, Install/Update en SOURCE (Web vs App)
(function() {
    const WEBHOOK_URL = 'https://n8n.vanlaar.cloud/webhook/app-stats';

    function checkStatusAndSend() {
        const savedVersion = localStorage.getItem('app_version');
        // We gebruiken de variabele die je bovenin app.js hebt staan
        const currentVersion = typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'unknown';
        
        let eventType = 'app_open';

        if (!savedVersion) {
            eventType = 'installatie';
        } else if (savedVersion !== currentVersion) {
            eventType = 'update';
        }

        // Verstuur de stats met de actuele versie
        sendStats(eventType, currentVersion);

        // Sla de versie op
        localStorage.setItem('app_version', currentVersion);
    }
    
    function sendStats(eventType, versionToSend) {
        // 1. Haal de CSS versie op
        const cssLink = document.getElementById('main-stylesheet');
        const cssVersion = cssLink && cssLink.href.includes('v=') ? cssLink.href.split('v=')[1] : 'geen-v';

        // 2. Bepaal de bron (Website of App)
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        const source = isPWA ? "App (PWA)" : "Website (Browser)";

        // 3. Verzamel alle data
        const data = {
            event: eventType,
            source: source, // <-- NIEUW: Onderscheid tussen Web en App
            version: versionToSend,
            css_version: cssVersion,
            os: /android/i.test(navigator.userAgent) ? "Android" : /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "iOS" : "Desktop",
            device: /Mobi|Android/i.test(navigator.userAgent) ? "Mobile" : "Desktop",
            screen: window.innerWidth + 'x' + window.innerHeight,
            referrer: document.referrer || 'direct',
            theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
            datum: new Date().toLocaleString('nl-NL')
        };

        console.log("Stats verzenden:", data);

        fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        }).catch(err => console.error("Stats Fetch error:", err));
    }

    // Start de check zodra de pagina volledig geladen is
    window.addEventListener('load', () => {
        // We wachten 1.5 seconde zodat Service Workers en variabelen stabiel zijn
        setTimeout(checkStatusAndSend, 1500);
    });

})();

// 1. DIRECT UITVOEREN (Tegen het flitsen van wit licht bij laden)
(function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('wotai-nightmode');
    }
})();

// 2. ZORG DAT HET ICOONTJE KLOPT BIJ OPSTARTEN
window.addEventListener('DOMContentLoaded', () => {
    const icon = document.querySelector('#dark-mode-toggle i');
    const isDark = document.body.classList.contains('wotai-nightmode');
    
    if (icon) {
        // Zet het icoon direct goed op basis van de huidige mode
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
});

// 3. DE SCHAKELAAR (Klik-functie)
function toggleDarkMode() {
    const body = document.body;
    const icon = document.querySelector('#dark-mode-toggle i');
    
    body.classList.toggle('wotai-nightmode');
    
    const isDark = body.classList.contains('wotai-nightmode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    if (icon) {
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    console.log("WotAI Mode is nu:", isDark ? "AAN" : "UIT");
}

// MELDING ONDERAAN SCHERM 
/**
 * PWA Toast Loader
 * Toont een uitnodiging om de app te installeren zonder de kern-logica te breken.
 */
// --- ÉÉN SCHONE EN WERKENDE TOAST FUNCTIE ---
function showInstallToast() {
    // 1. Alleen tonen als we NIET in de app zelf zitten
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isPWA) return;

    // 2. Voorkom dubbele toasts
    if (document.querySelector('.install-toast')) return;

    console.log("Toast wordt aangemaakt...");

    const toast = document.createElement('div');
    toast.className = 'install-toast';
    
    // We gebruiken de compacte HTML die we eerder hebben getest
    toast.innerHTML = `
        <i class="fas fa-mobile-alt"></i>
        <p class="toast-text">Install the Mobile APP for the best experience.</p>
        <a href="#" onclick="if(typeof triggerManualInstall === 'function'){ triggerManualInstall(event); } return false;" class="toast-link">Install</a>
    `;

    document.body.appendChild(toast);

    // 3. Toon de toast (animatie via CSS class 'show')
    setTimeout(() => toast.classList.add('show'), 100);

    // 4. Verwijder automatisch na 10 seconden
    setTimeout(() => {
        if (toast) {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 500);
        }
    }, 10000);
}

// 5. Start de toast pas 4 seconden na het laden van de pagina
// Dit zorgt dat je data eerst rustig kan laden
window.addEventListener('load', () => {
    setTimeout(showInstallToast, 4000);
});



function refreshWebcam() {
    const img = document.getElementById('webcamImage');
    const status = document.getElementById('cam-status');
    
    // Maak een unieke tijdstempel om caching te voorkomen
    const timestamp = new Date().getTime();
    
    // Update de bron van de afbeelding
    img.src = "https://www.meteology.gr/cam/milina/index.php?t=" + timestamp;
    
    // Even een visuele hint dat hij ververst
    status.style.opacity = "0.5";
    setTimeout(() => { status.style.opacity = "1"; }, 500);
}

// Ververs elke 10 seconden (10000 milliseconden)
setInterval(refreshWebcam, 10000);

// Start de eerste keer direct bij laden
window.onload = refreshWebcam;



function toggleNavEmergency(event) {
    event.preventDefault();
    event.stopPropagation();
    const menu = document.getElementById("navEmergencyMenu");
    menu.classList.toggle("is-open");
}

// Sluit het menu als je ergens anders klikt
window.addEventListener('click', function(e) {
    const menu = document.getElementById("navEmergencyMenu");
    if (menu && !menu.contains(e.target) && !e.target.closest('.sos-trigger')) {
        menu.classList.remove("is-open");
    }
});



/**
 * Sitemap Export Functie
 * Gebruik dit eenmalig om sitemap.xml te genereren
 */
function exportSitemap(businesses) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.kalanera.gr/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.kalanera.gr/wishlist.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`;

    businesses.forEach(biz => {
        // Maak een URL-vriendelijke slug die matcht met je IDs in de HTML
        const slug = biz.Name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        
        xml += `
  <url>
    <loc>https://www.kalanera.gr/#${slug}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    xml += `\n</urlset>`;
    
    console.log("--- START SITEMAP XML ---");
    console.log(xml);
    console.log("--- EINDE SITEMAP XML ---");

    // Start download automatisch
    const blob = new Blob([xml], { type: 'text/xml' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = 'sitemap.xml';
    link.click();
}