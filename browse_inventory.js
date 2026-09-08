let products = [];
let inventory = [];
let selectedCards = [];
let currentSearchResults = [];

async function loadData() {
    //update to data_local.txt later
    const response = await fetch(`data.txt?v=${Date.now()}`);
    const text = await response.text();
    const lines = text.split("\n").filter(line => line.trim() !== "");
    const currVersion = localStorage.getItem("dataVersion")

    let version = "unknown";

    // Check first line for version
    if (lines.length > 0 && lines[0].startsWith("#version=")) {
        version = lines[0].split("=")[1];
        lines.shift(); // remove version line
    }
    
    if (currVersion && currVersion !== version) {
        console.log("Data updated!");
    }
        
    products = text.split("\n")
        .filter(line => line.trim() !== "")
        .map(line => {
            const parts = line.split("|");
            return {
                name: parts[0],
                subtype: parts[1],
                price: Number(parts[2]),
                image: parts[3],
                cardNumber: parts[4], //unreliable
                rarity: parts[5],  //unreliable
                setName: parts[6],
                product_id: Number(parts[7])
            };
        });
    
    localStorage.setItem("dataVersion", version);
}

function renderSearch(searchResults) {
    const container = document.getElementById("searchResults");
    container.innerHTML = "";

    searchResults.forEach(p => {
        const div = document.createElement("div");
        div.className = "card";

        // Top section: image + information
        const cardInfo = document.createElement("div");
        cardInfo.className = "card-info";

        const imageContainer = document.createElement("div");
        imageContainer.className = "card-image-container";

        const image = document.createElement("img");
        image.src = p.image;
        image.loading = "lazy";
        image.alt = p.name;
        image.className = "card-image";

        imageContainer.appendChild(image);

        const details = document.createElement("div");
        details.className = "card-details";

        details.innerHTML = `
            <div class="card-name">${p.name}</div>
            <div class="card-subtype">${p.subtype}</div>
            <div class="card-set">${p.setName}</div>
            <div class="card-price">$${Number(p.price).toFixed(2)}</div>
        `;

        cardInfo.appendChild(imageContainer);
        cardInfo.appendChild(details);

        div.appendChild(cardInfo);

    });
}
async function loadInventory() {
    const response = await fetch("/api/public_inventory");
    inventory = await response.json();
}

function runSearch() {
    const input = document.getElementById("search");
    const value = input.value.toLowerCase();
    inventoryMap = {};
    if (!value.trim()) return;

    const tokens = normalize(value).split(/\s+/);

    for (const item of inventory) {
        inventoryMap[item.product_id] = item.quantity;
    }

    const filtered = products.filter(product => {
        // Card must actually be in stock
        if (!inventoryMap[product.product_id]) {
            return false;
        }
        const searchable = normalize(
            product.name + " " + product.setName
        );
        return tokens.every(token => searchable.includes(token));
    });
    filtered.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    currentSearchResults = filtered;
    renderSearch(currentSearchResults);
}

// init
window.onload = async function () {
    await loadData();
    await loadInventory();
}
