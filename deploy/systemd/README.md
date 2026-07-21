# Optional systemd unit if not using `pm2 startup`
#
# Prefer: pm2 startup + pm2 save
#
# Manual alternative (example):
#   [Unit]
#   Description=Movies API (PM2)
#   After=network.target
#   [Service]
#   Type=forking
#   User=movies
#   LimitNOFILE=65535
#   ExecStart=/usr/bin/pm2 resurrect
#   ExecReload=/usr/bin/pm2 reload all
#   ExecStop=/usr/bin/pm2 kill
#   [Install]
#   WantedBy=multi-user.target
