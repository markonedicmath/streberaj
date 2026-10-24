# Pregled zahteva iz razgovora

Dopuna 23. oktobra 2026: stvarna tabela pregledana je samo za čitanje kroz označeni Chrome tab, na nalogu koji već ima pristup. Potvrđeni su nedeljni listovi, dva stola i 15-minutni redovi. Dodati su povezivanje običnog Google naloga preko OAuth-a, šifrovano čuvanje odobrenja i minutna provera dok je aplikacija otvorena. Google OAuth klijent još nije konfigurisan, pa stvarni automatski uvoz nije aktiviran niti potvrđen. Postojeći zapis ispod ostaje pregled ranijih zahteva. Naknadno je interfejs pojednostavljen: navigacija iznad tabele, manje praznog prostora i uklonjen dekorativni okvir. Lokalni prikaz je pri ovoj dopuni blokiran pravilom pristupa pregledača; pregled je obavljen kroz kod. Testovi nisu pokretani.

Pregledano 21. oktobra 2026. prema kodu i prikazu aplikacije. Posle zahteva da se testovi ne pokreću nisu pokretane nove automatske provere. Ovaj spisak beleži primenjene funkcije; ne predstavlja potvrdu rada sa stvarnim Google nalogom ili tabelom.

## Raspored i izgled

- [x] Srpska latinica, svetla tema, naziv „Štreberaj”, bez uvodnih slogana, kartica sa opisima i obaveštenja o lokalnim primerima.
- [x] Odmah se prikazuje tabela. Dani imaju „Prvi sto” i „Drugi sto”; online termini imaju poseban prostor kada se uključi „Prikaži online”.
- [x] Satnica levo na svakih 15 minuta, od 06:00 do 23:00, sa izraženijim linijama na pun sat. Uklonjena oznaka GMT+2.
- [x] Leve oznake vremena centrirane su na horizontalnim linijama, uključujući 06:00 i 23:00. Male sive oznake unutar mreže prikazuju se samo na pun sat. „Sati u mreži” ih uključuje/isključuje; izbor se pamti u pregledaču i važi i za prikaz izvora.
- [x] Početno tekuća nedelja prema Europe/Belgrade; prethodne i buduće nedelje mogu da se prikažu i uređuju, uključujući prelazak godine.
- [x] „Danas” otvara današnji dan; „Ova nedelja” vraća tekuću nedelju. Dostupan je izbor dana i datuma.
- [x] Na telefonu ostaje nedeljni prikaz, automatski horizontalno pomeren na današnji dan. Satnica i zaglavlja ostaju fiksirani.
- [x] Zajednička visina svih redova menja se povlačenjem u satnici; „Default” i strelica su u gornjem levom uglu uže satnice, bez dodatnog levog prostora.
- [x] Izbor naloga je kompaktan, sa punim imenima i prezimenima koja se prelamaju umesto skraćivanja.
- [x] Predavači imaju veće kvadratne oznake i puno ime u legendi. Centralni izbor ograničen je na 20 boja sa crnim ili belim tekstom; zauzete boje su zabranjene i na serveru.
- [x] Manojlo koristi tamnu tirkiznu boju umesto ljubičaste; ljubičasta iz Google tabele i dalje se ispravno povezuje sa njim.
- [x] Probni podaci su očišćeni uz kopiju baze: razvojni časovi, kartoni, zaposleni, poruke, primeri cenovnika i probna uplata. Stvarni uvoz i noviji ručni unosi ostaju. Nova lokalna baza počinje bez probnih termina ili cena.
- [x] Brojači su veći i prilagođavaju se visini bloka. Vreme i podebljano trajanje uvek su u jednom redu, odvojeni razmakom. Veličina teksta se prilagođava stvarnoj širini; časovi do 45 minuta su kompaktniji.

## Unos i uređivanje časova

- [x] Dvoklik na prazno polje odmah otvara bočni panel i probni blok od 45 minuta za trenutnog predavača. Probni blok se odmah pomera i rasteže; podaci se menjaju zajedno sa panelom.
- [x] Dvostruki dodir na telefonu ima poseban obrađivač; pomeranje mreže ne računa se kao unos. Stvarni telefon nije bio dostupan za ovaj pregled.
- [x] „Novi čas” prikazuje učenika, online/uživo, datum, početak i trajanje. Predavač je pod „Više podešavanja”. Izbor stola i statusa nisu u panelu; pregled termina nema godinu.
- [x] Datum je prikazan kao dan/mesec, bez godine u polju, uz prečice Danas, Sutra, Prekosutra i Pon–Ned za naredni dolazak dana od danas. Prošli dan vodi u sledeću nedelju: plavo dugme, datum i oznaka „Sledeća nedelja” najavljuju prelazak. Preostali dani su svetlonarandžasti. Birač vremena nudi samo minute 00, 15, 30 i 45.
- [x] Matematika je podrazumevani predmet; ne zauzima prostor u osnovnom unosu ili bloku časa.
- [x] Svi predavači podrazumevano mogu da zakazuju za druge. Manojlo pojedinačno menja tu dozvolu. Osnovni izbor predavača je prijavljeni korisnik.
- [x] Dvoklik na postojeći čas i olovka otvaraju bočni panel sa animiranim ulaskom. Pri unosu/uređivanju na telefonu panel zauzima donju polovinu, da raspored ostane dostupan za povlačenje.
- [x] Ime učenika ima prednost u malom bloku. Vremenski raspon i broj minuta prikazuju se kada visina dozvoljava; najmanji blok zadržava ime i brojač.
- [x] Najnoviji cenovnik zamenjuje slobodan unos i izraze poput 2x45: trajanje se bira isključivo dugmadima 45, 60, 90 ili 120 min. Podrazumevano uključeno zaokruživanje ispravlja trajanja uvoza naniže, npr. 105 → 90 i 75 → 60 min, uz automatski cenovnik.
- [x] Časovi se pomeraju između dana, stolova i online prostora. Donja hvataljka i Alt+Shift+strelice biraju između četiri ponuđena trajanja, uključujući ponovno povećavanje smanjenog bloka.
- [x] Tokom povlačenja koristi se zatvorena šaka. Položaj ostaje privremeno prikazan dok server ne sačuva izmenu; potvrđeni automatski izbor drugog stola zamenjuje privremeni položaj.
- [x] Tokom unosa postoji probni blok u mreži. Promene polja odmah menjaju blok; povlačenje i rastezanje bloka ažuriraju polja.
- [x] Ako drugi sto rešava sukob, bira se automatski bez upozorenja. Preklapanje predavača, učenika ili zauzetost oba stola blokiraju čuvanje.
- [x] Sukobi se označavaju u mreži, uključujući probni blok. Greška pri čuvanju zadržava unete podatke. Novi učenik i čas čuvaju se zajedno.
- [x] Nema ručnog statusa ili kvačice za održavanje. Otkazani čas se briše. Protekli termini ulaze u brojače i obračun po završetku termina u zoni Europe/Belgrade; njihov izgled se ne menja.

## Izbor i istorija izmena

- [x] Dugme za brisanje, Del za izabrane časove i Esc za zatvaranje ili otkazivanje unosa.
- [x] Višestruki izbor: povlačenje pravougaonika, Shift/Ctrl + klik i Shift + strelice. Grupno pomeranje i brisanje čuvaju se kao jedna radnja.
- [x] Poništi navodi konkretnu radnju. Ponovi vraća poništenu radnju. Podržani su Ctrl+Z, Ctrl+Shift+Z i Ctrl+Y.
- [x] Poništavanje ne prepisuje naknadnu izmenu drugog korisnika niti pravi preklapanje. Pravilo jedinstvenih boja važi i pri poništavanju i ponavljanju.
- [x] Brisanje časa čuva novac i istoriju; poništene uplate ostaju zabeležene.

## Učenici i brojači

- [x] Ime učenika može imati jedan znak, uključujući brz unos pri zakazivanju i uvoz iz izvora.
- [x] Učenik ima zajednički ukupan broj održanih časova i trenutni paket kroz sve predavače i online časove.
- [x] Protekli čas doprinosi jednom; ponovno čuvanje ga ne udvostručuje. Brisanje ili pomeranje u budućnost uklanja doprinos. Stari podaci o statusima čuvaju se radi kompatibilnosti evidencije, bez korisničke kontrole statusa.
- [x] Veličina paketa nije fiksno četiri. Menja se u kartonu i direktnim prekucavanjem broja posle kose crte na času ili u tabeli učenika.
- [x] Brojevi paketa na časovima su uvećani. Zakazani časovi prikazuju očekivani hronološki redosled, npr. 1/5 pa 2/5; globalni brojači broje održane časove.
- [x] Dostupni su +1 i reset sa istorijom. Reset ne briše ukupan broj. Nema automatskog besplatnog četvrtog časa.
- [x] Načini dolaska su Preporuka, Direktno i Drugo. Preporuka ima opciono polje za preporučioca, a Drugo opciono objašnjenje.
- [x] Učenik ima svoje beleške i diskretan datum kreiranja kartona. Stari kartoni bez poznatog datuma ne dobijaju izmišljeni datum.
- [x] Karton sadrži istoriju časova. Materijali i prilozi su uklonjeni po poslednjem zahtevu.

## Poruke zaposlenih

- [x] Diskretna obaveštenja unutar postojećeg zaglavlja, bez pomeranja rasporeda ili prekrivanja sadržaja. Prikazuje se jedna kartica odjednom, približno 1,8 sekundi uz izlaznu animaciju; podaci se proveravaju na tri sekunde. Nema obaveštenja za staru istoriju pri prvom otvaranju.
- [x] X i Esc animirano zatvaraju bočne panele, uz poštovanje podešavanja smanjenog kretanja.
- [x] Kartica je preimenovana iz „Beleške” u „Poruke”, uključujući obaveštenja o porukama i prazan prikaz. Pristup imaju odobreni zaposleni.
- [x] Zvuk je podrazumevano isključen. „Podešavanja” uz nalog omogućavaju zasebno isključivanje obaveštenja i uključivanje zvuka. Izbor se čuva uz profil. Kada je zvuk uključen, zelena potvrda čuvanja časa koristi korisnikov `success.ogg`. Isključivanje prekida zvuk i ne vraća propuštena obaveštenja.
- [x] „Podešavanja” sadrže sopstveno ime, kontakt imejl, izbor nezauzete boje i prikaz satnih oznaka. Google adresa za prijavu ostaje zasebna od kontakta; uloga i dozvole se ne menjaju kroz lični profil.
- [x] Na telefonu je dodato veliko donje dugme „+”, uže nedeljne kolone i dnevni prikaz bez bočnog pomeranja. Filteri se prelamaju, a obračun prikazuje redove kao kartice sa izborom i zajedničkim kvačicama. Pregled u kodu je završen; fizički telefon još nije proveren.
- [x] Poruke, odgovori, pretraga, uređivanje, brisanje, sviđanja i zakačene poruke.
- [x] Izbor emodžija sa kategorijama i pretragom.
- [x] Povlačenje poruke u stranu priprema odgovor. Dvoklik ili dvostruki dodir dodaje sviđanje.

## Novac i pristup

- [x] Dozvole „Zakazuje za druge” i „Menja cenu” koriste radio dugmad Da/Ne u administraciji.
- [x] Klik na finansijsku kvačicu ili radio dozvole ne zatamnjuje niti zaključava ostale kontrole. Promena je odmah prikazana, zahtevi se čuvaju redom, a izmena dozvole menja samo izabrano polje.
- [x] Manojlov čas prikazuje „100% Manojlov deo” i pripadajući iznos.
- [x] Veliko crveno „Zaokruži na dole” sa kvačicom nalazi se u „Obračunu”, ispod „Za predaju Manojlu” i iznad tabele časova, uz objašnjenje i ukupne ispravke. Dostupno je administratoru i podrazumevano uključeno. Važi za postojeći i novi uvoz, obračun i XLSX. Originalna trajanja se čuvaju za isključivanje; ručne cene i novčane transakcije se ne brišu. Promene imaju istoriju i poništavanje/ponavljanje.
- [x] Brojači ispravljenih časova animiraju promenu vrednosti; pri svakom otvaranju „Obračuna” ukupni brojevi se animirano prebrojavaju.
- [x] „Preuzmi XLS” preuzima oblikovanu `.xlsx` datoteku sa pregledom po predavaču, detaljima časova, formulama i sačuvanim rezultatima; nepotpuni obračuni su označeni.
- [x] Pravila cene i Manojlovog procenta imaju redosled i uslove po predavaču, trajanju, formatu, nivou i načinu dolaska.
- [x] Automatske cene: 45 min = 1.000 RSD, 60 min = 1.500 RSD, 90 min = 2.000 RSD i 120 min = 2.500 RSD. Bez proporcionalnog obračuna.
- [x] Predavač dobija osnovnih 60%, plus po 10 procentnih poena za online, fakultet i preporuku. Dodaci se sabiraju do 90%; Manojlo dobija ostatak. Fakultet ima oznaku u kartonu, a obračun se prikazuje uživo tokom unosa.
- [x] Predavač podrazumevano menja cenu svog časa; Manojlo može da isključi dozvolu. Manojlov procenat menja administrator.
- [x] Cena i procenat ostaju uz čas. Kasniji cenovnik ne menja stare obračune. Korekcije ne brišu stvarne uplate i predaje novca.
- [x] Odvojeni su uplata učenika i predaja Manojlovog dela. Svaki aktivni zaposleni može neposredno da evidentira i potvrdi predaju zajedničkog časa uživo, bez dodatnog odobrenja Manojla. Prikazuju se dug i preplata, bez otpremanja dokaza uplata.
- [x] Obračuni prikazuju period, održane časove, naplaćeno, dugovanja i delove predavača i Manojla.
- [x] Tabela obračuna podržava izbor redova, svih prikazanih i raspona sa Shift + klik. „Plaćeno” i „Manojlo dobio deo” koriste kvačice pojedinačno i za ceo izbor, sa širokim klikabilnim površinama koje ne biraju ceo red. Uključivanje dopunjava ostatak bez dupliranja; isključivanje poništava unose uz istoriju. Svaki aktivni zaposleni može da označi i ukloni oznaku za zajednički čas uživo, bez posebne potvrde Manojla. Ranije nepotvrđene predaje se usklađuju. Njegovi sopstveni časovi nemaju predaju. Grupne promene su atomske, sa poništavanjem/ponavljanjem i ažuriranim XLSX obračunom.
- [x] Uklonjeni su kartica materijala, dugmad za otpremanje, preuzimanje, oznake slanja i serverske rute za datoteke. Zasebno skladište datoteka nije potrebno.
- [x] Zajedničke finansije časova uživo dostupne su svim aktivnim zaposlenima, radi označavanja uplata i predaja. Detalji kartona i uređivanje termina imaju zasebne dozvole. Svi zaposleni vide ime učenika, predavača i vreme tuđih zajedničkih termina, umesto oznake „Zauzeto”.
- [x] Privatni online čas vidi samo njegov predavač; Manojlo dobija pristup kada je čas podeljen. Povlačenje deljenja ne briše ranije potvrđene transakcije.
- [x] Preklapanja uključuju privatne termine bez otkrivanja njihovih detalja drugima.

## Google tabela i preostalo povezivanje

- [x] Administracija sadrži potvrđenu radnju „Ukloni probne podatke” za potpuno čišćenje operativne evidencije i ponovni uvoz. Pre zamene čuva se serverska kopija. Greška preuzimanja, prazan izvor i konkurentne izmene sprečavaju brisanje. Dugme nije pokrenuto tokom ove izmene.
- [x] Stvarna tabela je povezana Google nalogom za čitanje. Uvoz je ponovo pokrenut 23.10.2026. nakon povezivanja predavača iz legende.
- [x] Podrazumevani predavači su Manojlo Stanarević, Tijana Štrbac, Jelisaveta Letić, Tijana, Zoja, Milica Lapov i Nikodin. Manojlova boja je tamna tirkizna, Nikodinova plava ublažena; veze sa izvornim bojama ostaju sačuvane. Paleta i dalje ima 20 boja.
- [x] Oznaka „Sara 1/8” razdvaja se na karton „Sara” i broj/paket tog časa. Izvorni tekst ostaje sačuvan. Povezuju se samo jednoznačna tačna imena, bez pogađanja prezimena.
- [x] Na času se ručno menjaju oba broja brojača, uz izbor: samo taj čas, taj i budući ili taj i prethodni časovi. Korekcije imaju istoriju, poništavanje/ponavljanje i prednost nad Google uvozom. Globalni brojač se uređuje zasebno, bez menjanja ukupnog broja održanih časova.
- [x] Profili predavača mogu se pripremiti bez imejla; prijava ostaje nedostupna dok administrator ne unese stvaran odobren Google imejl.

- [x] Postoji alternativni produkcijski adapter za Supabase; novi cilj je Cloudflare D1 i direktna Google prijava. Supabase nije obavezan servis, a skladište priloga je uklonjeno.
- [x] Uvoz čita nedeljne kartice, dva stola po danu, 15-minutnu satnicu, tekst, boje, spojene ćelije i obojene blokove.
- [x] Podešavaju se godina i izričite veze boja, predavača i učenika. Dvosmislena imena ne spajaju se automatski.
- [x] Ponovljeni uvoz koristi postojeće veze. Lokalne izmene imaju prednost; neslaganja i nejasna pomeranja idu na pregled.
- [x] Brisanje iz izvora ne briše novac ili istoriju. Dostupni su ručno osvežavanje, vreme uspeha i prikaz izvorne mreže uz dozvole vidljivosti.
- [x] Pripremljeni su Google obaveštenja i rezervna provera svakog minuta uz konfiguraciju objavljenog servera.
- [ ] Za javnu verziju preostaju Cloudflare adapter, D1 baza, direktna Google prijava, stvarni imejlovi zaposlenih i javna HTTPS adresa. Google tabela je već povezana i lokalni uvoz radi.
