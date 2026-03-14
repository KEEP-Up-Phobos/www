# Database Backup Automation

To automatically back up your databases daily (e.g., at 3 AM), add a cron job.

1. Open your crontab:
   ```bash
   crontab -e
   ```

2. Add the following line at the end:
   ```cron
   0 3 * * * /bin/bash "/media/phobos/KEEP-Up App/shell/backup-db.sh" >> "/media/phobos/KEEP-Up App/shell/backup.log" 2>&1
   ```

3. Save and exit.

## Manual Backup
You can run the backup manually at any time:
```bash
./shell/backup-db.sh
```

Backups are stored in `../backups/db/` and kept for 7 days.
