📋 SANVASIFY APPLICATION - COMPLETE STRUCTURE DOCUMENTATION
Instance: ip-172-31-19-107 (EC2 Instance)
Date Generated: April 4, 2026
Application: Sanvasify Web Application
🏗️ ARCHITECTURE OVERVIEW
Sanvasify is a Go-based web application running on AWS EC2 with the following stack:
Backend: Go binary application server
Frontend: Static HTML/CSS/JavaScript files
Database: DuckDB for data storage and analytics
Web Server: Caddy for reverse proxy and SSL termination
SSL: Let's Encrypt certificates via Caddy
📁 COMPLETE DIRECTORY STRUCTURE
🏠 Main Application Directory: /opt/sanvasify/
/opt/sanvasify/
├── bin/
│   └── sanvasify                    # 55MB Go executable (main application server)
├── config/
│   └── Config.toml                  # 1KB application configuration file
├── data/
│   └── sanvasify.db                 # 3.9MB DuckDB database
└── web/
    └── static/                      # Web frontend assets
        ├── index.html               # 945B - Main landing page
        ├── login.html               # 811B - User authentication page
        ├── check_sif_nav.html       # 3KB - Navigation checker interface
        ├── nav_trends.html          # 2.4KB - Analytics trends page
        ├── Sanvasify.png            # 103KB - Application logo/branding
        ├── css/                     # Stylesheet directory
        ├── js/                      # JavaScript files directory
        └── images/                  # Image assets directory

🌐 Caddy Web Server Configuration
/usr/local/bin/caddy                 # Caddy binary executable
/etc/caddy/Caddyfile                 # Main Caddy configuration file

🔐 SSL Certificates & Data
~/caddy-backup/                      # Caddy data directory
├── certificates/                    # Let's Encrypt SSL certificates
├── acme/                           # ACME protocol data
├── pki/                            # Public Key Infrastructure
├── locks/                          # File locking mechanisms
├── autosave.json                   # Auto-save configuration
├── instance.uuid                   # Unique instance identifier
└── last_clean.json                 # Cleanup tracking data

🦆 Database Tools
/usr/local/bin/duckdb               # DuckDB CLI for analytics



📊 COMPONENT DETAILS TABLE
Component	Full Path	Size	Owner	Purpose
Application Binary	/opt/sanvasify/bin/sanvasify	55MB	sanvasify:sanvasify	Main Go web server
Configuration	/opt/sanvasify/config/Config.toml	1KB	sanvasify:sanvasify	App settings & DB config
Database	/opt/sanvasify/data/sanvasify.db	3.9MB	sanvasify:sanvasify	DuckDB data storage
Web Frontend	/opt/sanvasify/web/static/	~110KB	sanvasify:sanvasify	HTML/CSS/JS interface
Web Server	/usr/local/bin/caddy	-	root:root	Reverse proxy server
Web Config	/etc/caddy/Caddyfile	-	root:root	Domain & SSL config
SSL Certificates	~/caddy-backup/certificates/	-	ec2-user:ec2-user	HTTPS certificates
Analytics CLI	/usr/local/bin/duckdb	-	root:root	Advanced DB queries
🔗 APPLICATION FLOW DIAGRAM
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│   Internet  │───▶│    Caddy     │───▶│   Sanvasify     │───▶│   DuckDB     │
│   Traffic   │    │ (Port 80/443)│    │   Go Server     │    │   Database   │
└─────────────┘    └──────────────┘    └─────────────────┘    └──────────────┘
                           │                       │
                           ▼                       ▼
                   ┌──────────────┐    ┌─────────────────┐
                   │ SSL Certs    │    │  Static Files   │
                   │ (Let's       │    │  (HTML/CSS/JS)  │
                   │  Encrypt)    │    │                 │
                   └──────────────┘    └─────────────────┘

⚙️ SYSTEM PERMISSIONS
Application Files
Owner: sanvasify user and group
Permissions:
Binary: rwxr-x--x (executable by owner, readable by group)
Config: rwxr-x--- (read/write by owner, read by group)
Database: rw-r--r-- (read/write by owner, read by others)
Web files: rwxr-xr-x (executable/readable by all)
System Files
Caddy binary: root:root ownership
Caddy config: root:root ownership
SSL certificates: ec2-user:ec2-user ownership
🚀 QUICK ACCESS COMMANDS
Application Management
# View application status
sudo systemctl status sanvasify

# Check application logs
sudo journalctl -u sanvasify -f

# Restart application
sudo systemctl restart sanvasify

Run in CloudShell
Web Server Management
# Check Caddy status
sudo systemctl status caddy

# Reload Caddy configuration
sudo systemctl reload caddy

# View Caddy logs
sudo journalctl -u caddy -f

Run in CloudShell
Database Access
# Access database via DuckDB CLI
sudo -u sanvasify /usr/local/bin/duckdb /opt/sanvasify/data/sanvasify.db 

# Access DuckDB CLI
/usr/local/bin/duckdb

Run in CloudShell
Configuration Files
# Edit application config
sudo nano /opt/sanvasify/config/Config.toml

# Edit Caddy config
sudo nano /etc/caddy/Caddyfile

# View web files
sudo ls -la /opt/sanvasify/web/static/

Run in CloudShell
📝 NOTES
Security: All application files are owned by dedicated sanvasify user
SSL: Automatic certificate renewal handled by Caddy + Let's Encrypt
Database: SQLite database with 3.9MB of current data
Web Assets: Complete frontend with login, navigation, and trends interfaces
Analytics: DuckDB available for advanced data analysis
Backup: Caddy certificates backed up in ~/caddy-backup/
Document Version: 1.0
Last Updated: April 4, 2026