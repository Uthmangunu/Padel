# Import past games

Download the template from **History** and upload a UTF-8 CSV with this exact header:

```csv
date,match_type,home_player_1,home_player_2,away_player_1,away_player_2,home_games,away_games
2026-08-04,LEAGUE,Youssef,Saif,Uthman,Todimu,3,1
```

- `date` is `YYYY-MM-DD`.
- `match_type` is `CASUAL` or `LEAGUE`.
- Each row needs four different player names and a decisive whole-game score.
- New names are added to the selected roster at the 6.0 baseline rating.
- Import validates every row before writing anything. If one row is invalid, nothing is imported.

Imported records are confirmed one-fixture sessions. `LEAGUE` rows affect official League standings; `CASUAL` rows affect ordinary player statistics and History only.
