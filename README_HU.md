# Point Distance Measure 3.2

## PixInsight segédscript pixel- és szögtávolság mérésére

A **Point Distance Measure 3.2** egy interaktív PixInsight JavaScript/PJSR segédprogram. Két, képen kijelölt pont között pixelben mér távolságot, és megfelelő képi metaadatok esetén meghatározza a hozzá tartozó égi szögtávolságot is.

A pontok egérrel kijelölhetők, húzással vagy billentyűzettel finomíthatók. A script opcionálisan automatikusan a közeli csillag intenzitássúlyozott középpontjához igazítja a kijelölt pontot.

---

## Fő funkciók

- Két pont interaktív kijelölése közvetlenül a képen.
- Pixelkoordináták, X/Y eltérés és euklideszi pixeltávolság számítása.
- Valódi **1:1 nézet**, ahol egy eredeti képpixel egy képernyőpixelnek felel meg.
- Nagyítás, kicsinyítés, képernyőhöz igazítás és képnavigáció.
- Automatikusan nyújtott előnézet lineáris képekhez.
- Opcionális **csillagcentroid-illesztés**.
- A mérési pontok egérrel húzhatók.
- A kijelölt pontok nyílbillentyűkkel finomhangolhatók.
- Élő távolságkijelzés a második pont elhelyezése előtt.
- WCS-sel rendelkező képnél valódi gömbi szögtávolság számítása.
- Égi pozíciószög számítása P1-től P2 felé.
- WCS hiányában közelítő szögtávolság számítása a FITS-metaadatokból, ha rendelkezésre áll a képskála vagy a pixelméret és a fókusztávolság.
- Az eredmények megjelenítése a párbeszédablakban és a PixInsight konzolján.

---

## Indítás

A script közvetlenül futtatható a PixInsightból a JavaScript-fájl megnyitásával. Tartós menüpontként is hozzáadható a PixInsight scriptjeihez.

A script menüazonosítója:

`Utilities > PointDistanceMeasure`

Fájlnév:

`PointDistanceMeasure_v3_2.js`

Indításkor a script az aktuálisan aktív képet használja. Másik kép is kiválasztható vagy megnyitható a kezelőfelületről.

---

## Kezelőfelület

### Kép kiválasztása

**Use active image**  
Az aktuálisan aktív PixInsight-képet tölti be.

**Open image...**  
FITS, XISF vagy más, PixInsight által támogatott képfájl megnyitására szolgál.

A kép neve mellett megjelenik:

- a kép mérete pixelben;
- hogy rendelkezik-e használható WCS asztrometriai megoldással.

### Nagyítás és navigáció

**Fit**  
A teljes képet az előnézeti ablak méretéhez igazítja.

**1:1**  
Valódi teljes felbontású nézetet állít be: egy eredeti képpixel egy képernyőpixel.

**+ / −**  
Nagyítás vagy kicsinyítés előre meghatározott lépésekben.

**Egérgörgő**  
Az egérmutató körül nagyítja vagy kicsinyíti a képet.

**Bal vagy középső egérgomb húzása**  
A kép mozgatása az előnézeti ablakban. Ha a kattintás egy már kijelölt ponton történik, a bal egérgomb a pontot mozgatja.

Nagyobb nagyításnál a script a látható képrészletet közvetlenül az eredeti kép adataiból rendereli, ezért az 1:1 és az annál nagyobb nézet nem egy lekicsinyített előnézet felnagyítása.

### Automatikus nyújtás

**Auto-stretch preview**  
Automatikus megjelenítési nyújtást alkalmaz az előnézetre. Ez különösen lineáris, még nem nyújtott asztrofotók esetén hasznos.

A nyújtás kizárólag a script előnézetét érinti. Az eredeti képet nem módosítja.

### Csillagcentroid-illesztés

**Snap to star centroid**  
Bekapcsolt állapotban a script a kattintás vagy a marker elengedése után megkeresi a közelben található csillag intenzitássúlyozott középpontját.

**Radius**  
A keresési sugár eredeti képpixelben. Beállítható tartománya 2–20 pixel, alapértéke 7 pixel.

A centroid-illesztés akkor történik meg, ha a keresési területen a háttérzajhoz képest kellően megbízható csillagcsúcs található. Ha a script nem talál megfelelő csillagot, a kattintás eredeti helyét használja.

---

## Mérés egérrel

1. Nyisson meg vagy válasszon ki egy képet.
2. Szükség szerint használja a **Fit**, **1:1**, **+** és **−** vezérlőket.
3. Kattintson az első mérési pontra. Ez lesz **P1**.
4. Az egér mozgatásakor megjelenik a P1-től az egér helyéig húzott ideiglenes vonal és az élő távolságérték.
5. Kattintson a második pontra. Ez lesz **P2**.
6. A script automatikusan kiszámítja és megjeleníti az eredményeket.

Az első pont zöld, a második pont piros markerrel jelenik meg. A kijelölt marker fehér kiemelést kap.

Új mérés indításához a két pont rögzítése után kattintson egy új helyre. Ez lesz az új P1, majd a következő kattintás az új P2.

---

## A mérési pontok finomítása

### Mozgatás egérrel

Kattintson a P1 vagy P2 markerre, majd húzza a kívánt helyre. A mérés húzás közben frissül.

Ha a **Snap to star centroid** aktív, a marker az egérgomb elengedésekor megpróbál a közeli csillagközépre igazodni.

### Mozgatás billentyűzettel

1. Kattintson a P1 vagy P2 markerre a kijelöléséhez.
2. Használja a nyílbillentyűket:

- **nyílbillentyű:** 1,0 pixeles elmozdítás;
- **Shift + nyílbillentyű:** 0,1 pixeles elmozdítás.

A pontokat a script nem engedi a kép határain kívülre.

---

## Koordináták kézi megadása

A P1 és P2 koordinátái közvetlenül is beírhatók az alábbi mezőkbe:

- X1, Y1;
- X2, Y2.

A **Measure / apply coordinates** gomb ellenőrzi és alkalmazza a megadott értékeket.

A koordinátáknak a kép érvényes tartományán belül kell lenniük:

- X: 0 és képszélesség − 1 között;
- Y: 0 és képmagasság − 1 között.

A **Clear points** gomb törli a mérési pontokat és az aktuális eredményt.

---

## Megjelenített eredmények

### Minden képnél

- P1 és P2 koordinátái pixelben;
- Delta X és Delta Y;
- a két pont közötti pixeltávolság;
- a képsíkbeli irány, a pozitív X tengelytől az óramutató járásával megegyezően mérve.

### WCS-sel rendelkező képnél

A script a PixInsight natív kép–égbolt transzformációját használja külön-külön mindkét pontra. Megjeleníti:

- P1 rektaszcenzióját és deklinációját;
- P2 rektaszcenzióját és deklinációját;
- a pontok közötti gömbi főkörtávolságot ívmásodpercben, ívpercben és fokban;
- a P1 → P2 égi pozíciószöget, északtól kelet felé mérve;
- a kijelölt szakasz menti átlagos képskálát ívmásodperc/pixel egységben.

Ez pontosabb, mint a pixeltávolság és egyetlen átlagos képskála egyszerű összeszorzása, különösen nagy látómező vagy érzékelhető geometriai torzítás esetén.

### WCS nélküli képnél

Ha nincs használható natív WCS-transzformáció, a script megpróbál közelítő képskálát meghatározni a kép FITS/XISF metaadataiból.

A keresett adatok sorrendje:

1. WCS CD mátrix: `CD1_1`, `CD1_2`, `CD2_1`, `CD2_2`;
2. WCS képskála: `CDELT1`, `CDELT2`;
3. pixelméret: például `XPIXSZ`, `YPIXSZ`, `PIXSIZE`;
4. fókusztávolság: például `FOCALLEN`, `FOCLEN`, `FOCALLENGTH`.

Pixelméret és fókusztávolság esetén a közelítő képskála:

`képskála [ívmásodperc/pixel] = 206,264806 × pixelméret [µm] / fókusztávolság [mm]`

Az így meghatározott szögtávolságot a program egyértelműen közelítő eredményként jelöli.

---

## Pontosság és korlátok

- A pixeltávolság szubpixeles koordinátákkal is számítható.
- A csillagcentroid funkció intenzitássúlyozott középpontot számít, nem teljes PSF-modellt illeszt.
- Telített, összeolvadt, erősen torzult vagy ködösségbe ágyazott csillagoknál a centroid kevésbé megbízható lehet.
- Túl nagy keresési sugár esetén a script egy szomszédos, fényesebb csillagra ugorhat.
- Nagyon kis keresési sugár esetén előfordulhat, hogy a csillagcsúcs a keresési területen kívül marad.
- WCS-alapú szögtávolság pontossága az asztrometriai megoldás pontosságától függ.
- WCS nélküli, metaadatokból meghatározott szögtávolság csak közelítés.
- Az automatikus nyújtás és a markerek csak az előnézetet érintik; az eredeti kép nem változik.
- A script egyszerre egy mérési szakaszt kezel, és nem rajzol végleges jelölést az eredeti képre.

---

## Gyakorlati beállítási javaslatok

### Csillagok közötti távolság

- Kapcsolja be a **Snap to star centroid** funkciót.
- Kezdje 5–8 pixeles sugárral.
- Nagyítson legalább 1:1 nézetre.
- Ellenőrizze, hogy a marker valóban a kívánt csillagra ugrott-e.

### Nagy vagy telített csillag

- Növelje mérsékelten a keresési sugarat.
- Ha a centroid instabil, kapcsolja ki az automatikus illesztést, és állítsa be a pontot kézzel.

### Kettőscsillag vagy szoros csillagpár

- Használjon kis centroid-sugarat, hogy a két komponens ne kerüljön egy közös keresési területre.
- Nagyítson 2:1 vagy nagyobb nézetre.
- Finomítsa a pontokat Shift + nyílbillentyűkkel.

### Pontos égi szögtávolság

- A képet előzetesen oldja meg asztrometriailag a PixInsightban.
- Ellenőrizze, hogy a fejlécben a script `WCS: yes` állapotot jelez-e.

---

## Hibaelhárítás

### Nem jelenik meg szögtávolság

A kép nem rendelkezik használható WCS-megoldással, és a fejlécből sem határozható meg képskála. Oldja meg a képet asztrometriailag, vagy gondoskodjon a pixelméret és a fókusztávolság metaadatainak meglétéről.

### A centroid rossz csillagra ugrik

Csökkentse a **Radius** értékét, nagyítson a képre, és kattintson közelebb a kívánt csillag közepéhez.

### A centroid nem talál csillagot

Növelje óvatosan a keresési sugarat. Ellenőrizze, hogy a kattintás kellően közel történt-e a csillaghoz. Gyenge, diffúz vagy telített objektumnál kapcsolja ki a centroid-illesztést.

### Az előnézet lassú nagy nagyításnál

Nagy nagyításnál a script a látható területet az eredeti képből rendereli. Nagy előnézeti ablak, színes kép és magas nagyítás esetén ez számításigényesebb lehet. Mozgatás közben az áttekintő bitmapet használja, majd megállás után frissíti a teljes felbontású részletet.

---

## Verzió

**Point Distance Measure 3.2**

A script interaktív előnézeti és automatikus nyújtási megoldása részben a *Manual Image Solver Project* megközelítéséből készült, az eredeti kódban feltüntetett MIT-licencfeltételek szerint.

A program a képet nem módosítja, és a szoftver használata saját felelősségre történik.
