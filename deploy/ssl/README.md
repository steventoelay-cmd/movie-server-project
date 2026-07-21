# Certbot / Let's Encrypt notes
#
# Preferred (Nginx plugin):
#   sudo certbot --nginx -d api.example.com
#
# Webroot fallback:
#   sudo mkdir -p /var/www/certbot
#   sudo certbot certonly --webroot -w /var/www/certbot -d api.example.com
#
# Renewal dry-run:
#   sudo certbot renew --dry-run
#
# Certificates live under /etc/letsencrypt/live/<domain>/
# Nginx config: deploy/nginx/movies-api.conf
