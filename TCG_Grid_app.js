let products = [];
let selectedCards = [];
let incomingCards = {};
let outgoingCards = {};
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

function render(searchResults) {
    const container = document.getElementById("searchResults");
    container.innerHTML = "";
    const transactionType = document.querySelector('input[name="transactionType"]:checked').value;

    searchResults.forEach(p => {
        const div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `
            <img src="${p.image}" loading="lazy" />
            <div>
                <b>${p.name}</b><br/>
                ${p.subtype}<br/>
                $${p.price}<br/>
                ${p.setName}<br/>
            </div>
        `;

        if (transactionType === "BUY") {
            const direction = "IN"
            const addButton = document.createElement("button");
            addButton.textContent = "Buy";

            addButton.addEventListener("click", () => {
                addCard(p, direction,p.price);
            });

            div.appendChild(addButton);

        }
        else if (transactionType === "SELL") {
            const direction = "OUT"
            const addButton = document.createElement("button");
            addButton.textContent = "Sell";

            addButton.addEventListener("click", () => {
                addCard(p, direction ,p.price);
            });

            div.appendChild(addButton);

        }
        else {

            const receiveButton = document.createElement("button");
            receiveButton.textContent = "Receive";

            receiveButton.addEventListener("click", () => {
                addCard(p, "IN",p.price);
            });

            div.appendChild(receiveButton);

            const giveButton = document.createElement("button");
            giveButton.textContent = "Give";

            giveButton.addEventListener("click", () => {
                addCard(p, "OUT",p.price);
            });

            div.appendChild(giveButton);

        }

        container.appendChild(div);
    });
}
function getTransactionType() {
    return document.querySelector(
        'input[name="transactionType"]:checked'
    ).value;
}
function addCard(product, direction, value, condition) {
    const id = product.product_id;
    //const name = product.name;
    //const price = product.price;
    //const priceNum = parseFloat(price);
    const selected =
    direction === "IN"
        ? incomingCards
        : outgoingCards;
    //if (isNaN(priceNum)) return;
    const containerId =
    direction === "IN"
        ? "incomingCards"
        : "outgoingCards";
    if (!selected[id]) {
        selected[id] = {
            product: product,
            //name: name,
            //price: priceNum,
            //product_id: id,
            qty: 0,
            value: value,
            condition: "NM",
            notes: ""
        };
    }
    selected[id].qty++;

    refreshTransactionUI();
}

function removeCard(product,direction) {
    id=product.product_id;
    const selected =
    direction === "IN"
        ? incomingCards
        : outgoingCards;
    if (!selected[id]) return;
 
    selected[id].qty--;

    if (selected[id].qty <= 0) {
        delete selected[id];
    }
    refreshTransactionUI();
}
function refreshTransactionUI() {
    renderTransaction();
    updateTotals();
}
function clearAll(){
    incomingCards = {};
    outgoingCards = {};
    updateTotals();
    renderCardList(outgoingCards,"outgoingCards","OUT");
    renderCardList(incomingCards,"incomingCards","IN");
}

function updateTotals() {
    let incomingTotal = 0;
    let outgoingTotal = 0;
    let cashPaid=0;
    let cashReceived=0;
    const transactionType = getTransactionType();
    for (const id in incomingCards) {
        const card = incomingCards[id];
        incomingTotal += card.product.price * card.qty;
        cashPaid += card.value * card.qty;
    }
    for (const id in outgoingCards) {
        const card = outgoingCards[id];
        outgoingTotal += card.product.price * card.qty;
        cashReceived += card.value * card.qty;
    }
    let tradeValue=(incomingTotal*0.8).toFixed(2)
    let incomingHTML=`<b>Incoming Market:</b> $${incomingTotal.toFixed(2)}<br/>
        <b>Incoming CashValue:</b> $${(incomingTotal*0.7).toFixed(2)}<br/>
        <b>Incoming Cash:</b> $${(cashPaid).toFixed(2)}<br/>`
    let outgoingHTML=`<b>Outgoing Market:</b> $${outgoingTotal.toFixed(2)}<br/>
        <b>Outgoing Cash:</b> $${(cashReceived).toFixed(2)}<br/>`
    let tradeHTML=`<b>Incoming Market:</b> $${incomingTotal.toFixed(2)}
        <b>Incoming TradeValue:</b> $${(incomingTotal*0.8).toFixed(2)}<br/>
        <b>Incoming Cash:</b> $${(cashPaid).toFixed(2)}<br/>`
    if (transactionType === "BUY") {
        document.getElementById("totals").innerHTML=incomingHTML
    }
    else if (transactionType ==="SELL") {
        document.getElementById("totals").innerHTML=outgoingHTML
    }
    else {
        document.getElementById("totals").innerHTML=tradeHTML + outgoingHTML + `<b>Difference:</b> $${(tradeValue-cashReceived).toFixed(2)}<br/>`
    }
}

function normalize(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function runSearch() {
    const input = document.getElementById("search");
    const value = input.value.toLowerCase();

    if (!value.trim()) return;

    const tokens = normalize(value).split(/\s+/);

    const filtered = products.filter(product => {
        const searchable = normalize(
            product.name + " " + product.setName
        );

        return tokens.every(token => searchable.includes(token));
    });
    filtered.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    currentSearchResults = filtered;
    render(currentSearchResults);
}

function renderCardList(cards,containerId,direction){
    const container = document.getElementById(containerId);
    console.log("recndercardlist")
    container.innerHTML = "";
    for (const id in cards){
        const card = cards[id];

        const div = document.createElement("div");
        div.className = "cart-item";

        const text = document.createElement("div");
        text.className = "cart-text";
        
        text.innerHTML = `
            <div class="card-name">${card.product.name}</div>
            <div class="card-meta">
                Qty: ${card.qty} | Market: $${(card.product.price * card.qty).toFixed(2)}
            </div>
        `;

        const valueLabel = document.createElement("span");
        valueLabel.textContent = "Value: $";

        const valueInput = document.createElement("input");
        console.log("Creating value input for:", card.product.name);
        valueInput.type = "number";
        valueInput.step = "1";
        valueInput.min = "0";
        valueInput.value = card.value;

        valueInput.addEventListener("change", () => {
            card.value = Number(valueInput.value);
            renderTransaction();
            updateTotals();
        });

        text.appendChild(valueLabel);
        text.appendChild(valueInput);

        const actions = document.createElement("div");
        actions.className = "cart-actions";

        const addBtn = document.createElement("button");
        addBtn.textContent = "+";
        addBtn.onclick = () => addCard(card.product,direction,card.value);

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "-";
        removeBtn.onclick = () => removeCard(card.product,direction);

        actions.appendChild(addBtn);
        actions.appendChild(removeBtn);

        div.appendChild(text);
        div.appendChild(actions);
        container.appendChild(div);
    }
}

/* function renderSelectedCards() {
    const container = document.getElementById("selectedList");
    container.innerHTML = "";

    for (const id in selectedCards) {
        const card = selectedCards[id];

        const div = document.createElement("div");
        div.className = "cart-item";

        const text = document.createElement("div");
        text.className = "cart-text";

        text.innerHTML = `
            <div class="card-name">${card.product.name}</div>
            <div class="card-meta">
                Qty: ${card.product.qty} | $${(card.product.price * card.product.qty).toFixed(2)}
            </div>
        `;

        const actions = document.createElement("div");
        actions.className = "cart-actions";

        const addBtn = document.createElement("button");
        addBtn.textContent = "+";
        addBtn.onclick = () => addCard(card);

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "-";
        removeBtn.onclick = () => removeCard(id);

        actions.appendChild(addBtn);
        actions.appendChild(removeBtn);

        div.appendChild(text);
        div.appendChild(actions);
        container.appendChild(div);
    }
} */
function renderTransaction() {
    console.log(incomingCards);
    console.log(outgoingCards);
    renderCardList(incomingCards, "incomingCards", "IN");
    renderCardList(outgoingCards, "outgoingCards", "OUT");
}
function buildItems(cards, direction) {

    const items = [];

    for (const card of Object.values(cards)) {

        for (let i = 0; i < card.qty; i++) {

            items.push({
                product_id: card.product.product_id,
                direction: direction,
                condition: card.condition,          
                value: card.value,
                notes: null
            });

        }
    }

    return items;
}
async function saveTransaction(){
    const transactionType = getTransactionType();
    const cash_paid =
        parseInt(document.getElementById("cash_paid").value) || 0;

    const cash_received =
        parseInt(document.getElementById("cash_received").value) || 0;
    const direction =
    transactionType === "BUY" ? "IN" :
    transactionType === "SELL" ? "OUT" :
    null;
    /* for (const id in selectedCards) {
        const card = selectedCards[id]; */
    if (transactionType === "BUY" &&
    Object.keys(incomingCards).length === 0) {
    alert("Add at least one card.");
    return;
    }
    if (transactionType === "SELL" &&
        Object.keys(outgoingCards).length === 0) {
        alert("Add at least one card.");
        return;
    }
    if (transactionType === "TRADE" &&
        (Object.keys(incomingCards).length === 0 ||
        Object.keys(outgoingCards).length === 0)) {
        alert("Trades require at least one incoming and one outgoing card.");
        return;
    }
    const items = [
    ...buildItems(incomingCards, "IN"),
    ...buildItems(outgoingCards, "OUT")
    ];

    const transaction = {
    transaction_type: transactionType,
    cash_received: cash_received,
    cash_paid: cash_paid,
    items: items
    };

    //uncomment this and replace local host once we have the fastAPI in place
    //const response = await fetch("/api/transactions", {
    const response = await fetch("http://localhost:8000/api/transactions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(transaction)
    });

    if (response.ok) {
        alert("Transaction saved!");
    }
    else {
        alert("Failed to save transaction.");
    }
    clearCards();
}
async function loadInventory() {

    document.getElementById("searchView").style.display = "none";
    document.getElementById("inventoryView").style.display = "";
    document.getElementById("searchTab").classList.remove("activeTab");
    document.getElementById("inventoryTab").classList.add("activeTab");

    const response = await fetch("/api/inventory");
    const inventory = await response.json();

    renderInventory(inventory);
}

function renderInventory(inventory) {
    const body = document.getElementById("inventoryBody");
    body.innerHTML = "";
    //row.textContent =`product | condition | cost | price | profit/loss`
    for (const item of inventory){
        const product = products.find(
            p => p.product_id === item.product_id
        );
        if (!product){
            continue;
        }
        const row = document.createElement("tr");
        const profit = product.price - item.cash_paid;
        row.innerHTML = `
        <td>${product.name}</td>
        <td>${product.setName}</td>
        <td>${item.condition}</td>
        <td>$${product.price.toFixed(2)}</td>
        <td>$${item.cash_paid.toFixed(2)}</td>
        <td>$${profit.toFixed(2)}</td>
        <td>$${item.value}</td>
        `;
        body.appendChild(row);
        //row.textContent =`${product.name} | ${item.condition} | $${product.price} | $${item.cash_paid} | $${profit.toFixed(2)} | $${item.value}`;

        //container.appendChild(row);
    }
}

function updateTransactionUI() {

    const type = document.querySelector(
        'input[name="transactionType"]:checked'
    ).value;

    document.getElementById("incomingPanel").style.display = "";
    document.getElementById("outgoingPanel").style.display = "";

    if (type === "BUY") {
        document.getElementById("outgoingPanel").style.display = "none";
    }
    else if (type === "SELL") {
        document.getElementById("incomingPanel").style.display = "none";
    }
    //trades show both
    render(currentSearchResults);
}

function clearCards() {
    incomingCards = {};
    outgoingCards = {}
    renderTransaction();
}
function clearCashValues() {

    renderTransaction();
}
function showSearch() {

    document.getElementById("inventoryView").style.display = "none";
    document.getElementById("searchView").style.display = "";

    document.getElementById("inventoryTab").classList.remove("activeTab");
    document.getElementById("searchTab").classList.add("activeTab");
}
document.getElementById("search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        runSearch();
    }
});

document.getElementById("searchBtn").addEventListener("click", runSearch);
document.getElementById("inventoryTab").addEventListener("click", loadInventory);

document.getElementById("searchTab").addEventListener("click", showSearch);
document.getElementById("saveTransactionButton").addEventListener("click", saveTransaction);
//document.getElementById("clearBtn").addEventListener("click", clearAll);

// init
window.onload = function () {
    updateTransactionUI();
    loadData();
}
