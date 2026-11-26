# Nowi przeciwnicy: Wściekła Żona i Kluska Piekielna

## Modele 3D

Obie postacie korzystają z osobnych modeli proceduralnych Three.js — nie są wariantami jednego szablonu.

- `wkurzona_zona`: karykaturalna sylwetka, spięte ciemne włosy z grzywką, wyrazista mimika, niebieski sweter, bordowe spodnie, metaliczna patelnia z rantem i nitami oraz odkurzacz z turkusowym światłem, wężem i końcówką ssącą.
- `kluska_piekielna`: niska, czworonożna sylwetka, ciemnobrązowo-czarny grzbiet, jasna maska pyska i łapy, smuga na czole, bursztynowe oczy, widoczne kły, opadające uszy z jaśniejszym wnętrzem, pazury i czerwona obroża. Ogon i uszy mają osobne pivoty przygotowane do animacji.

Modele mają własne punkty obrotu kończyn, głowy i charakterystycznych rekwizytów. Nie zastępują innych archetypów.

## Czytelność walki

Obie postacie mają osobne sygnały ataku i profile telegraphów:

| Przeciwnik | Sygnał ataku | Zasięg | Czas odzyskiwania po chybieniu |
|---|---:|---:|---:|
| Wściekła Żona | 0,72 s | 0,98 m | 0,42 s |
| Kluska Piekielna | 0,34 s | 0,70 m | 0,18 s |

W Bestiariuszu wyświetlane są te same wartości, co w profilach walki. Żonę należy omijać ruchem bocznym, poza osią szerokiego zamachu. Przy Klusce należy zejść z toru krótkiego natarcia, zamiast uciekać prosto przed nią.

## Dostępność w trybach

W kampanii pojawiają się w sektorach B i C. W Survivalu są odblokowywane odpowiednio od fali 4 / 120 s i fali 6 / 210 s. Nie są częścią składu 1v1 PvP.

## Pochodzenie assetów

Base44 builder zgłosił błąd podczas próby wygenerowania pobieralnych, rigowanych plików GLB. Dlatego użyto dwóch odrębnych modeli proceduralnych Three.js. Po uzyskaniu rzeczywistych plików GLB można podłączyć je do istniejącego loadera bez zmiany identyfikatorów przeciwników.
