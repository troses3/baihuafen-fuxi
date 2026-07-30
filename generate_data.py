import json

data = [
    {"percent": "5.3%", "fraction": "1/19"},
    {"percent": "5.6%", "fraction": "1/18"},
    {"percent": "5.9%", "fraction": "1/17"},
    {"percent": "6.25%", "fraction": "1/16"},
    {"percent": "6.7%", "fraction": "1/15"},
    {"percent": "7.1%", "fraction": "1/14"},
    {"percent": "7.7%", "fraction": "1/13"},
    {"percent": "8.3%", "fraction": "1/12"},
    {"percent": "9.1%", "fraction": "1/11"},
    {"percent": "9.5%", "fraction": "1/10.5"},
    {"percent": "10.5%", "fraction": "1/9.5"},
    {"percent": "11.1%", "fraction": "1/9"},
    {"percent": "12%", "fraction": "1/8.3"},
    {"percent": "12.5%", "fraction": "1/8"},
    {"percent": "13%", "fraction": "1/7.7"},
    {"percent": "14%", "fraction": "1/7.1"},
    {"percent": "14.3%", "fraction": "1/7"},
    {"percent": "15%", "fraction": "1/6.7"},
    {"percent": "16%", "fraction": "1/6.25"},
    {"percent": "16.7%", "fraction": "1/6"},
    {"percent": "17%", "fraction": "1/5.9"},
    {"percent": "18%", "fraction": "1/5.6"},
    {"percent": "19%", "fraction": "1/5.3"},
    {"percent": "22.2%", "fraction": "1/4.5"},
    {"percent": "24%", "fraction": "1/4.2"},
    {"percent": "27%", "fraction": "1/3.7"},
    {"percent": "28.6%", "fraction": "1/3.5"},
    {"percent": "37%", "fraction": "1/2.7"},
    {"percent": "42%", "fraction": "1/2.4"},
    {"percent": "67%", "fraction": "1/1.5"},
]

# Generate random pairs as flashcards
# The id can be a number
cards = []
for i, item in enumerate(data):
    cards.append({
        "id": i + 1,
        "percent": item["percent"],
        "fraction": item["fraction"]
    })

with open("data.json", "w", encoding="utf-8") as f:
    json.dump(cards, f, ensure_ascii=False, indent=2)

print(f"Generated {len(cards)} cards in data.json")
