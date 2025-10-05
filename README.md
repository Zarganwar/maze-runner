# Maze Runner - Hra s bludiště

Jednoduchá hra do prohlížeče s pohledem z půdorysu, kde procházíte patry směrem dolů a sbíráte klíče.

## Jak hrát

1. Otevřete `index.html` v prohlížeči
2. Klikněte na tlačítko "Start" pro začátek hry
3. Použijte šipky (↑↓←→) pro pohyb postavou
4. Najděte klíč na každém patře
5. Doběhněte k červenému východu s klíčem v ruce
6. Dokončete patro před vypršením času

## Typy terénu

- 🟩 **Tráva** - Normální rychlost pohybu
- ❄️ **Sníh** - Pomalý pohyb
- 🗿 **Kámen** - Pomalý pohyb
- 🏖️ **Písek** - Normální rychlost
- 🌊 **Voda** - Neprůchozí
- 🌳 **Strom** - Neprůchozí
- 🟡 **Klíč** - Sbírejte pro otevření východu
- 🔴 **Východ** - Dokončení patra (potřebujete klíč)
- 🟣 **Past** - Odebere čas a skóre
- 🟠 **Trigger** - Náhodný pozitivní efekt

## Funkce

### Základní hra
- 5 předem připravených pater s různými tématy
- Systém skórování založený na čase a akcích
- Konfigurovatelné časové limity
- Žebříček nejlepších skóre (uložen lokálně)

### Editor pater
- Klikněte na "Editor" pro otevření editoru
- Vyberte typ dlaždice a klikněte na herní plochu
- Uložte vlastní patra do JSON souboru
- Načtěte vlastní patra ze souboru

### Ovládání
- **Start** - Začne novou hru
- **Restart** - Restartuje aktuální hru
- **Editor** - Otevře/zavře editor pater

## Soubory

- `index.html` - Hlavní HTML soubor s rozhraním
- `game.js` - Kompletní herní logika
- `sample_level.json` - Ukázkové patro pro editor
- `README.md` - Tento soubor

## Ukládání a načítání pater

Editor umožňuje:
1. Vytvoření vlastního patra pomocí různých dlaždic
2. Uložení patra do JSON souboru
3. Načtení patra ze souboru
4. Konfigurace časového limitu pro patro

Formát souboru obsahuje:
- `map` - 32x32 mřížka s čísly typů dlaždic
- `timeLimit` - Časový limit v sekundách

## Technické detaily

- Velikost mřížky: 32x32 dlaždic
- Velikost dlaždice na obrazovce: 20x20 pixelů
- Rychlost pohybu: Závislá na typu terénu
- Uložení skóre: localStorage prohlížeče
- Kompatibilita: Moderní webové prohlížeče s podporou HTML5 Canvas

Užijte si hru!