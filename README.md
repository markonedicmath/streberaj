# Štreberaj

Veb-aplikacija za raspored privatnih časova, učenike, pakete, naplatu, obračune i beleške. Interfejs je na srpskom, latinicom. Vremenska zona je `Europe/Belgrade`, a valuta RSD. Otpremanje materijala i dokaza uplata je uklonjeno; ne planira se zasebno skladište datoteka.

## Lokalno pokretanje

Potreban je Node.js 24 ili noviji.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Otvoriti `http://127.0.0.1:3000`. Lokalni režim se uključuje isključivo sa `MANOJLO_LOCAL_DEMO=1`, u razvojnom okruženju i preko lokalne adrese. Nalozi se menjaju u zaglavlju; padajući izbor zadržava pun naziv zaposlenog. Probni učenici, časovi, uplate i cenovnik su uklonjeni; stvarni uvoz i ručni unosi su sačuvani.

Podaci i izmene trajno ostaju u `.data/school.sqlite`. Za odvojene probe može se postaviti `MANOJLO_DATA_NAMESPACE=qa`; to koristi `.data/qa/`. Visina redova je podešavanje pregledača i čuva se lokalno. Za rezervnu kopiju lokalne baze zaustaviti server i kopirati ceo `.data` direktorijum.

## Rad u rasporedu

- Početno se otvara tekuća nedelja. Na telefonu je nedeljna mreža automatski pomerena na današnji dan. „Danas” prelazi na današnji dan, a „Ova nedelja” vraća nedeljni prikaz. Dostupan je izbor bilo kog datuma.
- Dvoklik ili dva kratka dodira na prazno polje odmah otvaraju bočni panel i probni blok od 45 minuta. Blok se odmah može pomerati i rastezati. Pomeranje mreže ne računa se kao dodir za unos. Novi učenik podrazumevano ima matematiku kao predmet.
- Novi čas odmah fokusira ime učenika, uz postojeće predloge. Enter vodi kroz datum (označen tekst dan/mesec), početak, trajanje i dugme „Sačuvaj čas”; naredni Enter čuva. Strelice biraju jedno od četiri trajanja. Posle uspešnog čuvanja panel se animirano zatvara; neuspešan unos ostaje otvoren.
- „Novi čas” prvo prikazuje učenika, datum, početak i trajanje. Predavač je pod „Više podešavanja”, bez polja „Način dolaska” u unosu časa. Datum u polju je samo dan/mesec, npr. 23/10; kalendar čuva celu godinu i dozvoljava prošle i buduće termine. Uz datum su Danas, Sutra, Prekosutra i Pon–Ned: svaki dan bira naredni dolazak tog dana od danas, bez vraćanja u prošlost. Dani u sledećoj nedelji su plavi, sa datumom i jasnom porukom „Sledeća nedelja” pri izboru; preostali su svetlonarandžasti. Birač početka nudi minute 00/15/30/45, a strelice u polju menjaju vreme za 15 minuta. Broj stola i status nisu u panelu. Pregled termina nema godinu. Na telefonu panel ostavlja raspored vidljivim za pomeranje probnog bloka.
- Klik na predlog povezuje tačan karton učenika; isto ime se ne koristi za automatsko spajanje različitih učenika.
- Ime učenika vidi se svim zaposlenima u zajedničkom rasporedu. Vreme i podebljano trajanje ostaju u jednom redu, bez tačke između, uz prilagođavanje veličine teksta širini bloka.
- Prevlačenje pomera čas između datuma i stolova. Kada je prikazan online raspored, čas se može prevući u online kolonu i nazad. Prelazak u online podrazumevano ne deli čas sa Manojlom.
- Ako je izabrani sto zauzet, a drugi slobodan za ceo termin, drugi sto se bira automatski bez upozorenja. Zauzetost oba stola i preklapanja predavača ili učenika i dalje sprečavaju čuvanje.
- Donja hvataljka bira najbliže ponuđeno trajanje: 45, 60, 90 ili 120 minuta. Dvoklik na čas ili olovka otvaraju detalje u bočnoj traci. Tastatura: Alt + strelice pomera početak, Alt + Shift + strelice bira prethodno ili sledeće ponuđeno trajanje.
- Povlačenje granice reda u satnici ili strelica uz „Default” menja visinu svih redova. „Default” vraća početnu visinu. Satnica je 06:00–23:00, uz užu levu kolonu bez dodatne margine.
- Vremena levo su centrirana na linijama mreže. Unutar mreže postoje male sive oznake samo na pun sat. Prekidač „Sati u mreži” ih skriva ili prikazuje i pamti izbor u pregledaču.
- Google tabela se otvara u širokom donjem panelu sa krem pozadinom, preko većine ekrana. Klik na naslov ili strelicu minimizuje je u donju traku i ponovo proširuje; X zatvara panel. Nedeljni raspored zadržava punu širinu i ostaje dostupan kada je panel minimizovan, uključujući telefon.
- „Poništi” opisuje i vraća poslednju sopstvenu izmenu, a „Ponovi” vraća poništenu radnju. Prečice su Ctrl + Z i Ctrl + Shift + Z (ili Ctrl + Y). Novija radnja prazni mogućnost ponavljanja. Naknadne izmene drugih korisnika ne prepisuju se. Poništena uplata ostaje u istoriji.
- Klik bira čas; Shift/Ctrl + klik dodaje ili uklanja čas iz izbora. Povlačenje miša preko praznog dela mreže bira više časova. Shift + strelice proširuje izbor. Izabrani časovi pomeraju se zajedno i brišu dugmetom ili tasterom Del. Grupna radnja se čuva i poništava kao celina. Esc zatvara detalje ili otkazuje unos/izbor. Brisanje čuva raniji novac, priloge i istoriju.
- Nema ručnog statusa ni kvačice. Otkazani termin se briše; termin koji je prošao automatski ulazi u brojače i obračun, prema vremenskoj zoni Europe/Belgrade. Izgled prošlog časa ostaje isti.
- Ime učenika ima prednost u malom bloku. Brojač na času prati redosled časova učenika kroz sve predavače: npr. ponedeljak `1/5`, utorak `2/5`. Budući časovi prikazuju očekivani redosled; globalni paket i ukupno održanih broje protekle termine. Oba broja mogu da se označe i prekucaju. Pri ispravci bira se samo ovaj čas, ovaj i prethodni ili ovaj i budući. Reset ne briše ukupan broj. Popusti se ne primenjuju automatski.
- Trajanje se bira isključivo dugmadima 45 / 60 / 90 / 120 min. Podrazumevano uključeno „Zaokruži na dole” ispravlja trajanja iz Google tabele: 75 postaje 60, a 105 postaje 90 minuta, uz odgovarajuću automatsku cenu. Izvorna tabela ostaje neizmenjena.
- Neposredno iznad „Više podešavanja” nalaze se tri kućice u jednom redu: Online, Fakultet i Preporuka. Svaka dodaje 10 procentnih poena predavaču i odmah osvežava obračun. Bez oznake Online čas je uživo. Fakultet i preporuka preuzimaju se iz kartona učenika, a izmena u ovom redu čuva se za konkretan čas.
- Obračun prikazuje ime izabranog predavača. Za Manojlove časove prikazuje se „100% Manojlov deo” i ceo iznos, bez duga za predaju novca samom sebi. Brojevi i oznake imaju kratke animacije, a prostor za objašnjenje ostaje iste visine pri promeni dodataka.
- Dok se unosi ili menja čas, mreža prikazuje njegov položaj uživo. Promena početka, trajanja, datuma ili online/uživo odmah menja blok. Probni blok može da se povlači i rasteže, a polja forme prate pomeranje. Sto se određuje prema mestu u mreži i dostupnosti. Preklapanja su označena crveno. Neuspešno čuvanje zadržava obrazac. Novi učenik i njegovi časovi čuvaju se zajedno.

## Poruke zaposlenih

Kartica „Poruke” otvara zajedničke poruke odobrenih zaposlenih. Podržani su odgovori, uređivanje svojih poruka, brisanje, sviđanja, kačenje i pretraga. Povlačenje poruke u stranu priprema odgovor, a dvoklik ili dvostruki dodir dodaje sviđanje. Izbor emodžija ima kategorije i pretragu. Manojlo može da obriše i tuđu poruku. Enter šalje poruku, Shift + Enter pravi novi red, Esc otkazuje uređivanje. Aplikacija proverava nove podatke na tri sekunde, na svim karticama. Podaci ostaju u istoj privatnoj školskoj bazi.

Zvukovi su podrazumevano isključeni. Zupčanik pored naloga otvara „Podešavanja”: prikaz obaveštenja se može isključiti, a zvuk zasebno uključiti. Izbor se čuva uz profil zaposlenog i važi za njegove uređaje. Kada je zvuk uključen, uspešno čuvanje časa daje zeleno obaveštenje sa kvačicom i korisnikov snimak `public/success.ogg`; ostala obaveštenja koriste kratke generisane tonove. Pregledač omogućava zvuk posle korisničkog klika, dodira ili tastera. Isključivanje zvuka prekida reprodukciju; ne pušta se propuštena istorija.

U istim podešavanjima zaposleni menja svoje ime, kontakt imejl i nezauzetu boju iz školske palete. Kontakt adresa je odvojena od Google naloga za prijavu, kojim Manojlo upravlja u administraciji. Sive oznake punih sati mogu se uključiti ili isključiti. Izmena profila ne menja ulogu ili dozvole.

Na telefonu je „Novi čas” veliko plutajuće dugme „+” pri dnu, iznad bezbedne ivice ekrana; skriva se kada je panel otvoren. Nedeljni raspored zadržava svih sedam dana i automatski se pomera na danas, uz uže kolone. Dnevni prikaz staje u širinu ekrana. Navigacija i filteri predavača se prelamaju, a finansijski redovi prelaze u kartice sa izborom i kvačicama, bez horizontalnog pomeranja. Raspored ostaje zasebna površina za horizontalno pomeranje. Ove izmene su pregledane u kodu; provera na fizičkom telefonu pre objavljivanja još predstoji.

Obaveštenja se pojavljuju u slobodnom prostoru postojećeg zaglavlja, bez prekrivanja sadržaja ili pomeranja rasporeda. Prvo otvaranje ne prikazuje staru istoriju. Prikazuje se po jedna kartica iz reda, veće grupe promena se sažimaju, a kartice nestaju posle približno 1,8 sekundi uz kratku izlaznu animaciju. Prelazak mišem ili fokusiranje pauzira nestajanje. Obaveštenja koriste samo podatke već dostupne prijavljenom zaposlenom. X i Esc u bočnim panelima koriste istu izlaznu animaciju kao uspešno čuvanje.

## Boje i kartoni učenika

Manojlo bira između tačno 20 boja. Zauzete boje su onemogućene i server odbija duplikate, uključujući poništavanje i ponavljanje izmene boje. Svaka pozadina ima unapred izabran crni ili beli tekst sa kontrastom najmanje 4,5:1. Izbor je zasnovan na [IBM paleti](https://www.ibm.com/design/language/color/) i [Carbon bojama](https://v10.carbondesignsystem.com/data-visualization/color-palettes/), uz prilagođene narandžastu i braon. Kontrast se računa prema [WCAG smernicama](https://www.w3.org/TR/WCAG22/#contrast-minimum).

Karton učenika sadrži opcione beleške. Ime može imati jedan znak, npr. „T”, i pri brzom unosu časa. „Preporuka” otvara polje za osobu koja je preporučila učenika; „Drugo” otvara opciono objašnjenje načina dolaska. Datum i vreme kreiranja prikazani su diskretno i nisu izmenjivi. Za stare kartone bez zapisanog datuma ne prikazuje se izmišljena vrednost.

## Administracija i izvoz

Dozvole „Zakazuje za druge” i „Menja cenu” biraju se radio dugmadima Da/Ne, u tabeli zaposlenih i njihovom obrascu.

Veliko crveno „Zaokruži na dole” sa kvačicom nalazi se u kartici „Obračun”, ispod ukupnih iznosa i „Za predaju Manojlu”, a iznad tabele časova. Dostupno je Manojlu i podrazumevano je uključeno. Ispravlja postojeće i nove uvezene časove na najbliže kraće ponuđeno trajanje; razlog je višak obojenog završnog polja u Google tabeli. Originalno trajanje ostaje sačuvano. Isključivanje ga vraća ako trajanje nije ručno izmenjeno. Automatske cene se usklađuju; ručne cene, uplate i predaje ostaju sačuvane, a salda prikazuju razliku. Podešavanje i izmene imaju istoriju i standardno poništavanje. Važi i za XLSX izvoz. Brojevi u ovom pregledu i ukupni iznosi pri svakom otvaranju kartice „Obračun” imaju kratku animaciju brojanja, uz poštovanje podešavanja smanjenog kretanja.

„Ukloni probne podatke” otvara potvrdu za potpunu zamenu operativnih podataka Google tabelom. Brišu se trenutni časovi, učenici, uplate, predaje, brojači i beleške; zaposleni, boje, dozvole, cenovnik i Google veza ostaju. Pre zamene čuva se poslednja serverska rezervna kopija. Preuzimanje se završava pre zamene; prazan izvor, greška pristupa ili konkurentna izmena prekidaju zamenu bez brisanja. Radnja nema uobičajeno poništavanje i ne pokreće se samim otvaranjem administracije.

„Preuzmi XLS” preuzima modernu `.xlsx` datoteku za izabrani period i predavača: oblikovan pregled po predavaču i detaljne časove, sa formulama za procente, delove, uplate, dugovanja i predaje. Sačuvane vrednosti formula omogućavaju prikaz pre ponovnog računanja u Excelu. Neodređene cene i procenti ostaju prazni i posebno su označeni. Izvoz koristi samo podatke dostupne prijavljenom korisniku.

Tabela u „Obračunu” podržava izbor pojedinačnih redova, svih prikazanih časova i raspona sa Shift + klik. Kućice „Plaćeno” i „Manojlo dobio deo” imaju široke klikabilne površine od najmanje 48 px visine, za pojedinačan čas i ceo izbor; klik u njihovoj ćeliji ne bira red. Uključivanje dopunjava samo preostali iznos, bez dupliranja. Isključivanje poništava odgovarajuće aktivne unose uz sačuvanu istoriju. Delimične uplate i mešovit izbor imaju crticu umesto kvačice. Svi aktivni zaposleni mogu da pregledaju i označe finansije zajedničkih časova uživo, uključujući tuđe časove. Oznaka predaje odmah važi za sve naloge, bez dodatnog Manojlovog odobravanja; svaki zaposleni može i da je ukloni. Ranije evidentirane nepotvrđene predaje prelaze u isti zajednički status. Manojlovi sopstveni časovi nemaju predaju. Grupna promena se čuva atomarno i podržava poništavanje/ponavljanje; zbirni obračun i XLSX koriste ažurirane transakcije. Privatni online termini zadržavaju dozvole vidljivosti.

Pregled zahteva iz razgovora nalazi se u [PREGLED-ZAHTEVA.md](PREGLED-ZAHTEVA.md).

## Plan objavljivanja: Cloudflare

Cilj je Cloudflare Workers sa zajedničkom D1 bazom za tekstualne podatke i direktnom Google prijavom. Supabase nije obavezan deo izabrane arhitekture. Adapter za Cloudflare/D1 i zamena postojećeg produkcijskog adaptera još nisu implementirani; lokalni rad trenutno koristi SQLite. Google tabela ostaje izvor za čitanje rasporeda. Bez otpremanja priloga nije potreban R2 ili drugi servis za datoteke.

### Postojeća alternativna implementacija preko Supabase-a

Sledeće uputstvo opisuje postojeći adapter, a ne izabrani plan objavljivanja:

1. Napraviti Supabase projekat i primeniti `supabase/migrations/202610210001_school.sql` u SQL editoru.
2. U Supabase Auth uključiti Google. U Google Cloud podesiti OAuth klijent za veb: Google callback je Supabase adresa `/auth/v1/callback`; u Supabase dozvoljene povratne adrese dodati adresu aplikacije `/auth/callback`.
3. Postaviti `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` i `MANOJLO_ADMIN_EMAIL`. `APP_URL` mora biti tačna javna HTTPS adresa aplikacije.
4. Isključiti lokalni režim. Pri prvom pristupu praznoj bazi dodaje se početni Manojlov nalog sa adresom iz `MANOJLO_ADMIN_EMAIL`. Ostale odobrene adrese dodaju se u administraciji. Nema otvorene registracije za zaposlene.
5. Pokrenuti `npm run build`, zatim `npm start`, ili objaviti aplikaciju na hostingu koji podržava Next.js i Node.js 24. Lokalni SQLite režim je onemogućen u produkciji.

Serverski API proverava Google sesiju i odobrenu adresu za svaki zahtev. Prava se sprovode pre vraćanja podataka. Privatni online čas dostupan je njegovom predavaču; Manojlo dobija detalje i obračun tek po deljenju. Drugi predavači dobijaju samo zauzetost zajedničkog rasporeda. Dozvole za menjanje cene i zakazivanje za druge podešavaju se po zaposlenom.

PostgreSQL adapter čuva transakcioni snimak školskih entiteta, sa brojem revizije, istorijom i identifikatorima obrađenih zahteva. Atomsko poređenje revizije i ponovno izvršavanje komande sprečavaju izgubljene izmene i istovremeno zauzimanje istog stola. RLS zabranjuje direktan pristup iz pregledača; API koristi serverski servisni ključ. Ovaj model je namenjen jednoj školi.

Cena i procenat čuvaju se uz čas. Nova pravila ne menjaju stare obračune. Naknadna promena cene menja dug/preplatu, dok stvarne uplate i predaje novca ostaju evidentirane. Predavači podrazumevano mogu da menjaju cenu i zakazuju za druge; uređivanje tuđih postojećih časova dostupno je Manojlu.

Osnovni cenovnik je 45 min = 1.000 RSD, 60 min = 1.500 RSD, 90 min = 2.000 RSD i 120 min = 2.500 RSD. Predavaču pripada 60%, uz po 10 procentnih poena za online čas, fakultet i preporuku; dodaci se sabiraju do 90%, a Manojlu pripada ostatak. Fakultet se označava u kartonu učenika, a postojeći opisi nivoa poput „Student”, „Fakultet” i „ETF” prepoznaju se automatski dok nije izričito označeno drugačije. Obračun je vidljiv tokom unosa. Promena fakulteta ili načina dolaska preračunava automatske iznose časova tog učenika bez evidentiranih uplata ili predaja; ručne korekcije ostaju sačuvane. Manojlo može zadati izuzetke kroz postojeća pravila cenovnika.

## Povezivanje Google tabele

Može se koristiti običan Google nalog koji već ima pravo čitanja tabele. Nije potreban vlasnikov nalog, njegova lozinka niti pravo uređivanja. Pristup iz otvorenog Chrome taba ne prenosi se automatski serveru. Aplikacija zato traži zasebno Google OAuth odobrenje; ne preuzima lozinke ili kolačiće iz pregledača.

### Povezivanje preko postojećeg Google naloga

1. U Google Cloud projektu aplikacije uključiti **Google Sheets API**. U Google Auth Platform podesiti naziv aplikacije, kontakt i publiku. Ako je projekat u režimu Testing, dodati Google nalog koji će povezati tabelu među test korisnike.
2. Napraviti OAuth klijent tipa **Web application**. U **Authorized redirect URIs** dodati tačnu adresu prikazanu u administraciji. Za trenutni lokalni server to je `http://127.0.0.1:3000/api/google/callback`. `APP_URL` mora koristiti isti domen, protokol i port. Za objavljenu aplikaciju dodati njenu HTTPS adresu sa istom putanjom.
3. U `.env.local`, odnosno tajne objavljenog servera, postaviti `GOOGLE_OAUTH_CLIENT_ID` i `GOOGLE_OAUTH_CLIENT_SECRET`. To su podaci klijenta aplikacije, a ne lozinka Google naloga. Na objavljenom serveru postaviti i `GOOGLE_TOKEN_ENCRYPTION_KEY`: 32 nasumična bajta kodirana kao Base64. Lokalni razvoj pravi i čuva ključ u `.data/google-token.key`. Sačuvati taj ključ uz rezervnu kopiju lokalne baze; produkcijski ključ ostaje u serverskim tajnama.
4. Ponovo pokrenuti lokalni server posle promene `.env.local`. U Administraciji sačuvati link tabele i početnu godinu, zatim kliknuti **Poveži Google nalog** i na Google strani izabrati nalog koji već može da čita tabelu. Forma za prvi unos predlaže dostavljenu Manojlovu tabelu. Postojeća konfiguracija se ne prepisuje.
5. Odobriti pristup za čitanje. Prvi uvoz preuzima izvorne blokove; zatim jednom povezati boje sa zaposlenima i izvorna imena sa učenicima. Dvosmisleni zapisi ostaju za pregled. Originalna tabela se ne menja.

Traži se `spreadsheets.readonly`, uz `openid email` radi prikaza povezanog naloga. Google ovaj opseg opisuje kao čitanje svih tabela kojima nalog može da pristupi; aplikacija poziva API samo za sačuvani ID izvora. Odobrenje je vezano za taj ID, pa promena tabele zahteva novo povezivanje. Zahtev za offline pristup omogućava osvežavanje tokena bez ponovnog prijavljivanja. Refresh token je šifrovan AES-256-GCM na serveru i ne ulazi u odgovor klijentu, istoriju poništavanja ili logove. Povratak sa Google-a proverava jednokratni kod, stanje, PKCE, nalog administratora i nepromenjen izvor.

Dok je aplikacija otvorena kod administratora, uvoz se pokreće odmah i proverava svakog minuta. Za samostalan rad dok su svi pregledači zatvoreni potreban je uključen server i serverski raspored opisan niže. OAuth varijanta koristi minutnu proveru i ne traži dodatni pristup Google Drive-u. Servisni nalog može dodatno koristiti Drive obaveštenja. Istovremeni zahtevi za uvoz koriste kratkotrajnu serversku rezervaciju; stari odgovor ne prepisuje naknadno promenjenu vezu.

U Google režimu Testing odobrenje sa ovim opsegom može isteći nakon sedam dana. Za trajan rad podesiti odgovarajući produkcijski status OAuth aplikacije i ispuniti Google zahteve za odobrenje opsega. Ako nalog izgubi pristup ili povuče odobrenje, prethodno uvezeni podaci ostaju sačuvani, a administracija prikazuje potrebu za ponovnim povezivanjem.

Zvanična uputstva: [Google OAuth za serverske aplikacije](https://developers.google.com/identity/protocols/oauth2/web-server), [opseg za čitanje tabela](https://developers.google.com/workspace/sheets/api/scopes) i [trajanje refresh tokena](https://developers.google.com/identity/protocols/oauth2/).

### Alternativa: servisni nalog škole

Potreban je serverski Google servisni nalog sa omogućenim Sheets i Drive API-jima. Vlasnik tabele podeli original sa adresom servisnog naloga samo za čitanje. Postaviti `GOOGLE_SERVICE_ACCOUNT_EMAIL` i `GOOGLE_PRIVATE_KEY` kao serverske tajne. Ključ se ne šalje pregledaču. Lično OAuth povezivanje tada nije obavezno.

U administraciji uneti link/ID tabele, godinu prve nedeljne kartice i veze boja i izvornih zapisa sa predavačima i učenicima. Podržana je struktura sa slike: satnica u prvoj koloni, sedam parova kolona za stolove, 15-minutni redovi i nedeljne kartice nazvane npr. `19.10–25.10`. Čitaju se i spojene ćelije i neprekinuti obojeni blokovi. Ako spojeni blok nema jedno ime ili je godina pogrešna, uvoz traži proveru.

Uvoz čuva izvorni tekst, datum, trajanje, boju i vezu sa časom. Lokalne izmene imaju prednost. Nejasna pomeranja, nepoznati učenici i boje prikazuju se za pregled. Brisanje u izvoru označava postojeću rezervaciju; ne briše novac, priloge i istoriju.

Za automatski rad na objavljenoj aplikaciji:

1. Postaviti jak `CRON_SECRET`.
2. U Supabase Vault sačuvati `streberaj_app_url` i `streberaj_cron_secret` sa istim vrednostima kao na serveru.
3. Primeniti `supabase/schedule.sql`. Provera se izvršava svakog minuta i kada aplikacija nije otvorena.
4. Prvi uspešan uvoz na HTTPS adresi registruje Drive obaveštenja na `/api/sync/webhook`; registracija se automatski obnavlja pre isteka. Vremenska provera ostaje rezervni mehanizam.

Uključene su provere kanala, tajnog tokena i Google identifikatora resursa. Neuspešan uvoz čuva prethodne podatke i beleži grešku. Google prijava, čitanje stvarne tabele, obaveštenja i cloud Storage zahtevaju stvarne pristupne podatke; lokalni testovi ih ne potvrđuju.

## Provere

```powershell
npm run typecheck
npm test
npm run build
```

Testovi obuhvataju prava pristupa, privatne online časove, preklapanja i kapacitet, cenovnik, pakete, korekcije novca, poništavanje, parsiranje Google mreže, očuvanje lokalnih izmena, vremensku zonu i mapiranje visine redova. PostgreSQL migracija i trke pri čuvanju proveravaju se stvarnim PostgreSQL izvršavanjem preko PGlite-a.

Za HTTP probe pokrenuti odvojeni server:

```powershell
$env:NEXT_DIST_DIR='.next-qa'
$env:MANOJLO_DATA_NAMESPACE='qa'
$env:APP_URL='http://127.0.0.1:3001'
npm run dev -- --port 3001
```

U drugom terminalu:

```powershell
$env:TEST_BASE_URL='http://127.0.0.1:3001'
npx tsx --test tests/http.test.ts
```

HTTP probe proveravaju trajno čuvanje, idempotentne uplate, paralelne rezervacije, CSRF i privatnost priloga, u odvojenoj bazi.
