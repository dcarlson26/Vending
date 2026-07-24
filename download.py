import requests
import time
from collections import defaultdict
import argparse
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}
parser = argparse.ArgumentParser()
parser.add_argument(
    "--only-cards",
    action="store_true",
    help="Only include products that are cards"
)

args = parser.parse_args()

def get_extended_value(product, key_name):
    for item in product.get("extendedData", []):
        if item.get("name") == key_name:
            return item.get("value")
    return None

pokemon_category = '3'
version = str(int(time.time()))

# Open the file in write mode ('w' to overwrite or 'a' to append)
with open("data.txt", "w") as file:
    file.write(f"#version={version}\n")
    try:
        r = requests.get(f"https://tcgcsv.com/tcgplayer/{pokemon_category}/groups",
                         headers=headers)
        r.raise_for_status()  # Will raise an exception for HTTP errors
        all_groups = r.json().get('results', [])
        
        if not all_groups:
            file.write("No groups found\n")
        
        for group in all_groups:
            
            group_id = group['groupId']
            group_name = group['name']
            #Perfect Order Only for testing
            #if group_id != 24587:
            #    continue
            
            #SW+SH onwards
            if group_id < 2545 and not group_id == 1729 and not group_id == 1465: 
                continue
                
            try:
                # Fetch products for the group
                r = requests.get(f"https://tcgcsv.com/tcgplayer/{pokemon_category}/{group_id}/products",headers=headers)
                r.raise_for_status()
                products = r.json().get('results', [])
                if not products:
                    file.write(f"No products found for group {group_id}\n")
                
                #for product in products:
                #    file.write(f"{product['productId']} - {product['name']}\n")
                # Build lookup: id -> list of name entries
                name_lookup = defaultdict(list)
                img_lookup = defaultdict(list)
                rarity_lookup = {}
                card_number_lookup = {}
                allowed_product_ids = set()
                for product in products:
                    name_lookup[product['productId']].append(product['name'])  
                    img_lookup[product['productId']].append(product['imageUrl'])
                    if args.only_cards:
                        #if product["name"] == "Mega Greninja ex - 122/086":print(product["extendedData"])
                        rarity = get_extended_value(product, "Rarity")
                        card_number = get_extended_value(product, "Number")
                        rarity_lookup[product["productId"]] = rarity
                        card_number_lookup[product["productId"]] = card_number
                        if rarity is None or card_number is None:
                            continue  #skip this product
                    allowed_product_ids.add(product["productId"])

            except Exception as e:
                file.write(f"Failed to fetch products for group {group_id}: {e}\n")
            
            try:
                # Fetch prices for the group
                r = requests.get(f"https://tcgcsv.com/tcgplayer/{pokemon_category}/{group_id}/prices",headers=headers)
                r.raise_for_status()
                prices = r.json().get('results', [])
                if not prices:
                    file.write(f"No prices found for group {group_id}\n")
                
                #for price in prices:
                    #file.write(f"{price['productId']} - {price['subTypeName']} - {price['marketPrice']}\n")
            
            except Exception as e:
                file.write(f"Failed to fetch prices for group {group_id}: {e}\n")
            
            for p in prices:
               product_id = p["productId"]
               names=name_lookup.get(product_id, 'Unknown')
               urls=img_lookup.get(product_id, 'Unknown')
               rarity = rarity_lookup.get(product_id)
               card_number = card_number_lookup.get(product_id)
               name_str = ", ".join(names)
               imageUrl = ", ".join(urls)
               if product_id not in allowed_product_ids:
                    #print(f"Skipping price for excluded product: {name_str}-{product_id}")
                    continue
               file.write(f"{name_str}|{p['subTypeName']}|{p['marketPrice']}|{imageUrl}|{card_number}|{rarity}|{group_name}|{product_id}\n")
    
    except requests.exceptions.RequestException as e:
        file.write(f"An error occurred: {e}\n")