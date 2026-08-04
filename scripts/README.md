# scripts/

Dieses Verzeichnis enthält Hilfsskripte für den Entwicklungs- und Konfigurationsprozess.

## Enthaltene Scripts

| Script | Beschreibung |
|--------|-------------|
| `sync_assessment_config.bat` | Windows-Batch-Script zum Synchronisieren der Assessment-Konfiguration zwischen Umgebungen. Verwendet `sync_assessment_config.py`. |
| `sync_assessment_config.py` | Python-Script zum Abgleich und Migrieren von `config/assessment_config.json` zwischen Branches oder Umgebungen. |

## Verwendung

```bat
scripts\sync_assessment_config.bat
```

oder direkt:

```bash
python scripts/sync_assessment_config.py
```
