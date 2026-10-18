// citizens sprites for the retro renderer. Edit the grids by hand, or export/import a PNG with `npm run sprites`.
// Every character must be in the legend described in the comment lines below.
export default String.raw`
# The city screen's citizens: whole figures 7 wide and 13 tall, standing 8 apart. Each sprite holds
# a man (columns 0-6) and a woman (columns 8-14) in one mood or trade: short and long hair, or with
# "-2" a beard and a headscarf (in her trousers' colour). Arms up happy, at the sides content, crossed
# unhappy; the entertainer wears a jester's cap, the taxman a bowler and a purse, the scientist
# glasses and a flask. citizens.ts swaps the stand-in colours for each person's own.
# Legend: . clear  k black  w white  y yellow  I cyan  z dark grey
#   P/p clothes, the mood's colour (light/dark)   6/4 skin (light/shade, ramp flesh)
#   b/d hair (dark/light, ramp earth)   C/B trousers (light/dark, ramp grey)

@happy
k.kkk.k.k.kkk.k.
6kbbbk6.6kbbbk6.
pk464kp.pb464bp.
pk666kp.pb666bp.
kpk6kpk.kpk6kpk.
.pPPPp...pPPPp..
.kPPPk...kPPPk..
.kPPPk...kPPPk..
.kPPPk...kPPPk..
.kCCCk...kPPPk..
.kCkCk..kPPPPPk.
.kCkCk..kkkkkkk.
.kk.kk....k.k...
................
................
................

@happy-2
k.kkk.k.k.kkk.k.
6kbbbk6.6kCCCk6.
pk464kp.pC464Cp.
pkb6bkp.pC666Cp.
kpkbkpk.kpCCCpk.
.pPPPp...pPPPp..
.kPPPk...kPPPk..
.kPPPk...kPPPk..
.kPPPk...kPPPk..
.kCCCk...kPPPk..
.kCkCk..kPPPPPk.
.kCkCk..kkkkkkk.
.kk.kk....k.k...
................
................
................

@content
..kkk.....kkk...
.kbbbk...kbbbk..
.k464k..kb464bk.
.k666k..kb666bk.
..k6k...kbk6kbk.
kpPPPpk.kpPPPpk.
kpPPPpk.kpPPPpk.
kpPPPpk.kpPPPpk.
k6PPP6k.k6PPP6k.
.kCCCk...kPPPk..
.kCkCk..kPPPPPk.
.kCkCk..kkkkkkk.
.kk.kk....k.k...
................
................
................

@content-2
..kkk.....kkk...
.kbbbk...kCCCk..
.k464k..kC464Ck.
.kb6bk..kC666Ck.
..kbk....kCCCk..
kpPPPpk.kpPPPpk.
kpPPPpk.kpPPPpk.
kpPPPpk.kpPPPpk.
k6PPP6k.k6PPP6k.
.kCCCk...kPPPk..
.kCkCk..kPPPPPk.
.kCkCk..kkkkkkk.
.kk.kk....k.k...
................
................
................

@unhappy
..kkk.....kkk...
.kbbbk...kbbbk..
.k464k..kb464bk.
.k666k..kb666bk.
..k6k...kbk6kbk.
.kpPpk...kpPpk..
kpPPPpk.kpPPPpk.
kp666pk.kp666pk.
kpPPPpk.kpPPPpk.
.kCCCk...kPPPk..
.kCkCk..kPPPPPk.
.kCkCk..kkkkkkk.
.kk.kk....k.k...
................
................
................

@unhappy-2
..kkk.....kkk...
.kbbbk...kCCCk..
.k464k..kC464Ck.
.kb6bk..kC666Ck.
..kbk....kCCCk..
.kpPpk...kpPpk..
kpPPPpk.kpPPPpk.
kp666pk.kp666pk.
kpPPPpk.kpPPPpk.
.kCCCk...kPPPk..
.kCkCk..kPPPPPk.
.kCkCk..kkkkkkk.
.kk.kk....k.k...
................
................
................

@entertainer
kPkkkPk.kPkkkPk.
.kPpPk...kPpPk..
.k464k..kb464bk.
.k666k..kb666bk.
..k6k...kbk6kbk.
kpPPPpk.kpPPPpk.
kpPPPpk.kpPPPpk.
kpPPPpk.kpPPPpk.
k6PPP6k.k6PPP6k.
.kCCCk...kPPPk..
.kCkCk..kPPPPPk.
.kCkCk..kkkkkkk.
.kk.kk....k.k...
................
................
................

@entertainer-2
kPkkkPk.kPkkkPk.
.kPpPk...kPpPk..
.k464k..kC464Ck.
.kb6bk..kC666Ck.
..kbk....kCCCk..
kpPPPpk.kpPPPpk.
kpPPPpk.kpPPPpk.
kpPPPpk.kpPPPpk.
k6PPP6k.k6PPP6k.
.kCCCk...kPPPk..
.kCkCk..kPPPPPk.
.kCkCk..kkkkkkk.
.kk.kk....k.k...
................
................
................

@taxman
..kzk.....kzk...
kzzzzzk.kzzzzzk.
.k464k..kb464bk.
.k666k..kb666bk.
..k6k...kbk6kbk.
kpPPPpk.kpPPPpk.
kpPPPpk.kpPPPpk.
kpPPkyk.kpPPkyk.
k6PPkyk.k6PPkyk.
.kCCCk...kPPPk..
.kCkCk..kPPPPPk.
.kCkCk..kkkkkkk.
.kk.kk....k.k...
................
................
................

@taxman-2
..kzk.....kzk...
kzzzzzk.kzzzzzk.
.k464k..kC464Ck.
.kb6bk..kC666Ck.
..kbk....kCCCk..
kpPPPpk.kpPPPpk.
kpPPPpk.kpPPPpk.
kpPPkyk.kpPPkyk.
k6PPkyk.k6PPkyk.
.kCCCk...kPPPk..
.kCkCk..kPPPPPk.
.kCkCk..kkkkkkk.
.kk.kk....k.k...
................
................
................

@scientist
..kkk.k...kkk.k.
.kbbbkw..kbbbkw.
.kwkwkI.kbwkwkI.
.k666k6.kb666b6.
..k6kpk.kbk6kpk.
kpPPPp..kpPPPp..
kpPPPk..kpPPPk..
kpPPPk..kpPPPk..
k6PPPk..k6PPPk..
.kCCCk...kPPPk..
.kCkCk..kPPPPPk.
.kCkCk..kkkkkkk.
.kk.kk....k.k...
................
................
................

@scientist-2
..kkk.k...kkk.k.
.kbbbkw..kCCCkw.
.kwkwkI.kCwkwkI.
.kb6bk6.kC666C6.
..kbkpk..kCCCpk.
kpPPPp..kpPPPp..
kpPPPk..kpPPPk..
kpPPPk..kpPPPk..
k6PPPk..k6PPPk..
.kCCCk...kPPPk..
.kCkCk..kPPPPPk.
.kCkCk..kkkkkkk.
.kk.kk....k.k...
................
................
................
`;
