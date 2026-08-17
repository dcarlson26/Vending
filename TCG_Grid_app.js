let products = [];
let selectedCards = [];
let incomingCards = {};
let outgoingCards = {};
let currentSearchResults = [];
let cash_paid = 0;
let cash_received = 0;

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
            value: Number(value),
            market_value: Number(product.price),
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
    let cashIncomingVal=0;
    let cashOutgoingVal=0
    const transactionType = getTransactionType();
    for (const id in incomingCards) {
        const card = incomingCards[id];
        incomingTotal += card.product.price * card.qty;
        cashIncomingVal += card.value * card.qty;
    }
    for (const id in outgoingCards) {
        const card = outgoingCards[id];
        outgoingTotal += card.product.price * card.qty;
        cashOutgoingVal += card.value * card.qty;
    }
    let tradeValue=(incomingTotal*0.8);
    let buyValue=(incomingTotal*0.7);
    let incomingValue=0;
    if (transactionType === "BUY") { 
        incomingValue=buyValue;
    }
    else if (transactionType === "TRADE")  {
        incomingValue=tradeValue;
    }
    let html = `
        <div class="summary-title">Summary</div>
        <table class="transaction-summary">
            <thead>
                <tr>
                    <th></th>
                    <th>Market</th>
                    <th>Value</th>
                </tr>
            </thead>

        <tbody>
    `;

    if (transactionType === "BUY" || transactionType === "TRADE") {
        html += `
            <tr>
                <td>Incoming</td>
                <td>$${incomingTotal.toFixed(2)}</td>
                <td>$${incomingValue.toFixed(2)}</td>
            </tr>
        `;
    }

    if (transactionType === "SELL" || transactionType === "TRADE") {
        html += `
            <tr>
                <td>Outgoing</td>
                <td>$${outgoingTotal.toFixed(2)}</td>
                <td>$${cashOutgoingVal.toFixed(2)}</td>
            </tr>    
        `;
    }
    html += `
            </tbody>
        </table>
    `;

    const tradeDifference = cashOutgoingVal-(Math.round(incomingValue));
    const absoluteDifference = Math.abs(tradeDifference);
    if (transactionType === "BUY") {
        cash_paid = Math.round(cashIncomingVal * .7);
        cash_received = 0;
    }
    else if (transactionType === "SELL") {
        cash_received = Math.round(cashOutgoingVal);
        cash_paid = 0;
    }
    else if (transactionType === "TRADE") {
        if (tradeDifference > 0) {
            cash_received = tradeDifference;
            cash_paid = 0;
        }
        else if (tradeDifference < 0) {
            cash_paid = Math.abs(tradeDifference);
            cash_received = 0;
        }
        else {
            cash_paid = 0;
            cash_received = 0;
        }
    }
    if (transactionType === "TRADE") {
        if (tradeDifference > 0) {
            html += `
                <div class="trade-balance">
                    <div>Trade Balance</div>
                    <div class="trade-balance-amount">
                        You receive $${absoluteDifference} cash
                    </div>
                </div>
            `;
        }
        else if (tradeDifference < 0) {
            html += `
                <div class="trade-balance">
                    <div>Trade Balance</div>
                    <div class="trade-balance-amount">
                        You pay $${absoluteDifference} cash
                    </div>
                </div>
            `;
        }
        else {
            html += `
                <div class="trade-balance">
                    <div>Trade Balance</div>
                    <div class="trade-balance-amount">
                        Even trade
                    </div>
                </div>
            `;
        }
    }
    if (transactionType === "BUY") {
        html += `
        <div class="buy-balance">
            <div>Buy Balance</div>
                Pay them $${cash_paid} cash
            </div>
        </div>
    `;
    }
    if (transactionType === "SELL") {
        html += `
        <div class="sell-balance">
            <div>Sell Balance</div>
                Pay me $${cash_received} cash
            </div>
        </div>
    `;
    }
    document.getElementById("totals").innerHTML = html;
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
                Qty: ${card.qty} | Market: $${(card.market_value).toFixed(2)}
            </div>
        `;

        const valueLabel = document.createElement("span");
        valueLabel.textContent = "Value: $";

        const valueInput = document.createElement("input");
        valueInput.type = "number";
        valueInput.step = "1";
        valueInput.min = "0";
        valueInput.value = card.value;

        valueInput.addEventListener("change", () => {
            card.value = Number(valueInput.value);
            console.log("card value updated")
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
    renderCardList(incomingCards, "incomingCards", "IN");
    renderCardList(outgoingCards, "outgoingCards", "OUT");
}
function buildItems(cards, direction, transactionType) {

    const items = [];

    for (const card of Object.values(cards)) {

        for (let i = 0; i < card.qty; i++) {

            items.push({
                product_id: card.product.product_id,
                direction: direction,
                condition: card.condition,          
                value: getCardVal(card,transactionType,direction),
                market_value: card.market_value,
                notes: null
            });
        }
    }

    return items;
}
function getCardVal(card,transactionType,direction){
    if (transactionType === "BUY" && direction === "IN") {
        return card.market_value * 0.7;
    }

    if (transactionType === "TRADE" && direction === "IN") {
        return card.market_value * 0.8;
    }

    // For an outgoing card, we need its stored acquisition value.
    if (direction === "OUT") {
        return card.value;
    }

    return card.value;
}

async function saveTransaction(){
    const transactionType = getTransactionType();
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
    ...buildItems(incomingCards, "IN",transactionType),
    ...buildItems(outgoingCards, "OUT",transactionType)
    ];

    const transaction = {
    transaction_type: transactionType,
    cash_received: cash_received,
    cash_paid: cash_paid,
    items: items,
    transaction_date: transactionDateInput.value
    };

    //uncomment this and replace local host once we have the fastAPI in place
    //const response = await fetch("/api/transactions", {
    //const response = await fetch("http://localhost:8000/api/transactions", {
    const response = await fetch("/api/transactions", {
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
    clearTransaction();
}
async function loadInventory() {
    showInventory();

    const response = await fetch("/api/inventory");
    const inventory = await response.json();

    renderInventory(inventory);
}
function showInventory() {
    document.getElementById("transactionsView").style.display = "none";
    document.getElementById("searchView").style.display = "none";
    document.getElementById("inventoryView").style.display = "";
    document.getElementById("searchTab").classList.remove("activeTab");
    document.getElementById("transactionTab").classList.remove("activeTab");
    document.getElementById("inventoryTab").classList.add("activeTab");
}

function renderInventory(inventory) {
    const body = document.getElementById("inventoryBody");
    body.innerHTML = "";

    let totalMarket = 0;
    let totalCashPaid = 0;
    let totalProfit = 0;
    let totalValue = 0;

    for (const item of inventory) {
        const product = products.find(
            p => p.product_id === item.product_id
        );

        if (!product) {
            continue;
        }

        const marketPrice = Number(product.price);
        const cashPaid = Number(item.cash_paid);
        const value = Number(item.value);
        const profit = marketPrice - cashPaid;

        totalMarket += marketPrice;
        totalCashPaid += cashPaid;
        totalProfit += profit;
        totalValue += value;

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${product.name}</td>
            <td>${product.setName}</td>
            <td>${item.condition}</td>
            <td>$${marketPrice.toFixed(2)}</td>
            <td>$${cashPaid.toFixed(2)}</td>
            <td>$${profit.toFixed(2)}</td>
            <td>$${value.toFixed(2)}</td>
        `;

        body.appendChild(row);
    }

    const footer = document.getElementById("inventoryTotals");

    footer.innerHTML = `
        <tr>
            <td colspan="3"><strong>Total</strong></td>
            <td><strong>$${totalMarket.toFixed(2)}</strong></td>
            <td><strong>$${totalCashPaid.toFixed(2)}</strong></td>
            <td><strong>$${totalProfit.toFixed(2)}</strong></td>
            <td><strong>$${totalValue.toFixed(2)}</strong></td>
        </tr>
    `;

    
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

function clearTransaction() {
    incomingCards = {};
    outgoingCards = {}
    cashPaid = 0;
    cashReceived = 0;
    renderTransaction();
    updateTotals();
}

function showSearch() {

    document.getElementById("inventoryView").style.display = "none";
    document.getElementById("searchView").style.display = "";
    document.getElementById("transactionsView").style.display = "none";

    document.getElementById("inventoryTab").classList.remove("activeTab");
    document.getElementById("searchTab").classList.add("activeTab");
    document.getElementById("transactionTab").classList.remove("activeTab");

}

async function loadTransactions() {
    const today = getLocalDateString();
    startDate = document.getElementById("transactionStartDate").value;
    endDate = document.getElementById("transactionEndDate").value;

    if (!startDate || !endDate) {
        alert("Please select both dates.");
        return;
    }
    if (startDate > endDate) {
        alert("Start date cannot be after end date.");
        return;
    }
    //const response = await fetch(`http://localhost:8000/api/transactions?start_date=${startDate}&end_date=${endDate}`);
    const response = await fetch(`/api/transactions?start_date=${startDate}&end_date=${endDate}`);

    if (!response.ok) {
        console.error("Failed to load transactions");
        return;
    }

    const transactions = await response.json();

    renderTransactions(transactions);
}
function renderTransactions(transactions) {
    const container = document.getElementById("transactionResults");
    const summary = document.getElementById("transactionSummary");
    const today = getLocalDateString();

    container.innerHTML = "";
    summary.innerHTML = "";

    if (transactions.length === 0) {
        container.textContent = "No transactions found.";
        return;
    }

    transactions.forEach(transaction => {
        const wrapper = document.createElement("div");
        wrapper.className = "transaction-entry";

        const header = document.createElement("button");
        header.className = "transaction-header";

        const cashText =
            transaction.cash_received > 0
                ? `Cash received: $${transaction.cash_received.toFixed(2)}`
                : transaction.cash_paid > 0
                    ? `Cash paid: $${transaction.cash_paid.toFixed(2)}`
                    : "No cash";

        header.innerHTML = `
            <span>
                <strong>${transaction.transaction_type}</strong>
                &nbsp; ${transaction.transaction_date}
            </span>

            <span>
                ${cashText} &nbsp; ▼
            </span>
        `;

        const details = document.createElement("div");
        details.className = "transaction-details";
        details.style.display = "none";

        transaction.items.forEach(item => {
            const product = products.find(
                p => Number(p.product_id) === Number(item.product_id)
            );

            const itemDiv = document.createElement("div");
            itemDiv.className = "transaction-item";

            itemDiv.innerHTML = `
                <strong>
                    ${product ? product.name : `Unknown card (${item.product_id})`}
                </strong>

                <div>
                    ${item.direction}
                    | Market: $${Number(item.market_value).toFixed(2)}
                    | Value: $${Number(item.value).toFixed(2)}
                </div>
            `;

            details.appendChild(itemDiv);
        });

        header.addEventListener("click", () => {
            const isHidden = details.style.display === "none";

            details.style.display = isHidden ? "block" : "none";

            // Change arrow
            header.innerHTML = `
                <span>
                    <strong>${transaction.transaction_type}</strong>
                    &nbsp; ${transaction.transaction_date}
                </span>

                <span>
                    ${cashText} &nbsp; ${isHidden ? "▲" : "▼"}
                </span>
            `;
        });

        wrapper.appendChild(header);
        wrapper.appendChild(details);

        container.appendChild(wrapper);
    });
    renderTransactionSummary(transactions);
}
function showTransactions() {
    document.getElementById("searchView").style.display = "none";
    document.getElementById("inventoryView").style.display = "none";
    document.getElementById("transactionsView").style.display = "block";

    document.getElementById("inventoryTab").classList.remove("activeTab");
    document.getElementById("searchTab").classList.remove("activeTab");
    document.getElementById("transactionTab").classList.add("activeTab");

}
function renderTransactionSummary(transactions){
    let sales = 0;
    let inventoryAdded = 0;
    let cashPaidForInventory = 0;
    let tradeCashReceived = 0;
    let tradeCashPaid = 0;
    let tradeValueIn = 0;
    let tradeValueOut = 0;

    for (const transaction of transactions) {

        // Actual cash received from selling cards
        if (transaction.transaction_type === "SELL") {
            sales += Number(transaction.cash_received);
        }

        // Actual cash paid/received as part of trades
        if (transaction.transaction_type === "TRADE") {
            tradeCashReceived += Number(transaction.cash_received);
            tradeCashPaid += Number(transaction.cash_paid);
        }

        // Inventory that came IN
        for (const item of transaction.items) {
            if (item.direction === "IN") {
                inventoryAdded += Number(item.market_value);
            }
            if (transaction.transaction_type === "TRADE") {
                if (item.direction === "IN") {
                    tradeValueIn += Number(item.value);
                }

                if (item.direction === "OUT") {
                    tradeValueOut += Number(item.value);
                }
            }
        }

        // Cash paid on purchases
        if (transaction.transaction_type === "BUY") {
            cashPaidForInventory += Number(transaction.cash_paid);
        }
    }

    const summary = document.getElementById("transactionSummary");

    summary.innerHTML = `
        <div class="transaction-summary">
            <div class="summary-title">Show Summary</div>

            <div class="summary-grid">
                <div>Sales</div>
                <div>$${sales.toFixed(2)}</div>

                <div>Inventory Added (Market)</div>
                <div>$${inventoryAdded.toFixed(2)}</div>

                <div>Cash Paid for Inventory</div>
                <div>$${cashPaidForInventory.toFixed(2)}</div>

                <div>Trade Cash Received</div>
                <div>$${tradeCashReceived.toFixed(2)}</div>

                <div>Trade Cash Paid</div>
                <div>$${tradeCashPaid.toFixed(2)}</div>

                <div>Trade Value In</div>
                <div>$${tradeValueIn.toFixed(2)}</div>

                <div>Trade Value Out</div>
                <div>$${tradeValueOut.toFixed(2)}</div>
            </div>
        </div>
    `;    
}
function getLocalDateString() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
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

document.getElementById("transactionTab").addEventListener("click", showTransactions);
document.getElementById("loadTransactionsButton").addEventListener("click", loadTransactions);
const today=getLocalDateString();
const transactionDateInput = document.getElementById("transactionDate");
document.getElementById("transactionStartDate").value  = today;
document.getElementById("transactionEndDate").value  = today;
transactionDateInput.value = today;

startDateInput = document.getElementById("transactionStartDate");
endDateInput = document.getElementById("transactionEndDate");

startDateInput.addEventListener("change", () => {
    if (!endDateInput.value) {
        endDateInput.value = startDateInput.value;
    }
});

endDateInput.addEventListener("change", () => {
    if (!startDateInput.value) {
        startDateInput.value = endDateInput.value;
    }
});

//document.getElementById("clearBtn").addEventListener("click", clearAll);

// init
window.onload = function () {
    updateTransactionUI();
    loadData();
}
