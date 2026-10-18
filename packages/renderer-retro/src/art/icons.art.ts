// icons sprites for the retro renderer. Edit the grids by hand, or export/import a PNG with `npm run sprites`.
// Every character must be in the legend described in the comment lines below.
export default String.raw`
# Icons, 8x8, for the info panels and the badges on working units. Outlined in black so each reads
# on the main screen's grey, the city screen's blue, the dialogs' brown and a unit badge's black.
# people: a man and a woman; food: an ear of wheat; shield (production, the rules' shields): a hammer.
# Legend: . clear  k black  w white  P/p owner colour/dark
#   r/R red  y yellow  Y brown  u/U blue  n/N green  i/I cyan  z/Z grey (EGA)
#   0-7 shades of ramp 1, a-h of ramp 2, A-H of ramp 3. Default ramps: grey, earth, stone.

@people ramps=flesh,earth
.bb..kk.
k22kkddk
k22kd66d
.kk.dkkd
kUUkkRRk
kUUkRRRk
kYYkRRRk
kk.kkkkk

@calendar
.kk..kk.
kRRRRRRk
krrrrrrk
kwwwwwwk
kwzwzwzk
kwwwwwwk
kwzwzwwk
kkkkkkkk

@coin
..kkkk..
.kyyyyk.
kyywyyyk
kywyyyyk
kyyyyyyk
kyyyyyYk
.kyyYYk.
..kkkk..

@purse
..kkkk..
...kk...
..kYYk..
.kyyyyk.
kyyyyyyk
kyywyyyk
kyyyyyyk
.kkkkkk.

@gem
........
.kkkkkk.
kIwIIIIk
kkkkkkkk
.kIIIIk.
..kIIk..
...kk...
........

@bulb
..kkkk..
.kyyyyk.
kyywyyyk
kyyyyyyk
.kyyyyk.
..kyyk..
..kZZk..
...kk...

@crown
.k.kk.k.
kykyykyk
kyyyyyyk
kyRyyRyk
kyyyyyyk
kYYYYYYk
kkkkkkkk
........

@hourglass
kkkkkkkk
.kyyyyk.
..kyyk..
...kk...
...kk...
..kwyk..
.kyyyyk.
kkkkkkkk

@food ramps=plains,earth
.k..k..k
.k7kk7k.
k75k75kk
.k7k7k..
k75k75k.
.kk7kk..
..kck...
..kck...

@shield ramps=stone,earth
.kkkkkk.
k776665k
k665554k
.kkkdkk.
...kdk..
...kdk..
...kck..
...kkk..

@trade
....kk..
kkkkkyk.
kyyyyyyk
kkkkkyk.
.kykkkkk
kyyyyyyk
.kykkkkk
..kk....

@boot
..kkk...
..kYYk..
..kYYk..
..kYYk..
..kYYkk.
.kYYYYYk
kYYYYYYk
kkkkkkkk

@tower ramps=grey,earth,stone
kk.kk.kk
kGkGFkFk
kGGFFFEk
.kGFFEk.
.kGFFEk.
.kGkkEk.
.kGkkEk.
kkkkkkkk

@heart
.kk..kk.
kRRkkRRk
kRwRRRRk
kRRRRRrk
.kRRRrk.
..kRrk..
...kk...
........

@star
...k....
..kyk...
kkkykkk.
kyyyyyk.
.kyyyk..
.kyyyk..
kyk.kyk.
kk...kk.

@house
...kk...
..kRRk..
.kRRRRk.
kRRRRRRk
.kwwwwk.
.kwkkwk.
.kwkkwk.
.kkkkkk.

@river
.kkkkkk.
kUUUUUUk
kUwwUUwk
kwUUwwUk
kUUUUUUk
kUwwUUwk
kwUUwwUk
.kkkkkk.

@road
...kk...
..kfyk..
..kffk..
.kffyfk.
.kffffk.
kfffyffk
kffffffk
kfffyffk

@railroad
.z....z.
kYYYYYYk
.z....z.
.z....z.
kYYYYYYk
.z....z.
.z....z.
kYYYYYYk

@irrigate
...k....
..kUk...
..kUk...
.kUwUk..
kUwUUUk.
kUUUUuk.
.kUUuk..
..kkk...

@mine
..kkkk..
.kZwZZk.
kZkkkkzk
kzkYYkzk
k.kYYk.k
..kYYk..
..kYYk..
...kk...

@fortress ramps=grey,earth,stone
kk.kk.kk
kGkFFkEk
kGGFFFEk
kGGFFFEk
kGFkkFEk
kGFkkFEk
kGFkkFEk
kkkkkkkk

@pollution
..kkk...
.kZZZkk.
kZwZZZZk
kZzZZzZk
kzzzzzzk
.kkkkkk.
..Y..Y..
.Y..Y...

@clean
......kk
.....kYk
....kYk.
..kkYk..
.kyyyk..
kyyyyyk.
kyykyyk.
.kkkkk..

@hut
...kk...
..kYYk..
.kYYYYk.
kYYYYYYk
kkkkkkkk
.kgkkgk.
.kgkkgk.
.kkkkkk.

@city
.....kk.
.kk..kwk
kwwk.kwk
kwwkkkwk
kwkwwkwk
kwwwwwwk
kwkwwkwk
kkkkkkkk

@swords
wk....kw
kwk..kwk
.kwkkwk.
..kwwk..
..kwwk..
.kYkkYk.
kYk..kYk
Yk....kY
`;
