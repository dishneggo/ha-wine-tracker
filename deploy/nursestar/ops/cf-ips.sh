#!/bin/sh
# Regenerate the Cloudflare IP snippets used by the wine.clearnuvo.com vhost
# and reload nginx only if the new config tests clean.
# Do not run on Fridays 8 AM to 6 PM ET (NurseStar change blackout).
set -eu

SNIPPETS=${SNIPPETS:-/etc/nginx/snippets}
RELOAD=${RELOAD:-1}

v4=$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4)
v6=$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6)

# Refuse to write an empty or obviously broken list.
n4=$(printf '%s\n' "$v4" | grep -cE '^[0-9.]+/[0-9]+$' || true)
n6=$(printf '%s\n' "$v6" | grep -cE '^[0-9a-f:]+/[0-9]+$' || true)
if [ "$n4" -lt 5 ] || [ "$n6" -lt 3 ]; then
    echo "cf-ips: unexpected list sizes (v4=$n4 v6=$n6), not touching nginx" >&2
    exit 1
fi

tmp_real=$(mktemp)
tmp_geo=$(mktemp)
trap 'rm -f "$tmp_real" "$tmp_geo"' EXIT
stamp=$(date -Is)
{
    echo "# generated $stamp by cf-ips.sh from cloudflare.com/ips-v4 and ips-v6"
    for r in $v4 $v6; do echo "set_real_ip_from $r;"; done
} > "$tmp_real"
{
    echo "# generated $stamp by cf-ips.sh from cloudflare.com/ips-v4 and ips-v6"
    for r in $v4 $v6; do echo "$r 1;"; done
} > "$tmp_geo"

real="$SNIPPETS/cloudflare-ips.conf"
geo="$SNIPPETS/cloudflare-geo.conf"
[ -f "$real" ] && cp "$real" "$real.bak"
[ -f "$geo" ] && cp "$geo" "$geo.bak"
install -m 644 "$tmp_real" "$real"
install -m 644 "$tmp_geo" "$geo"

if [ "$RELOAD" = "1" ]; then
    if nginx -t; then
        systemctl reload nginx
    else
        echo "cf-ips: nginx -t failed, restoring previous snippets" >&2
        [ -f "$real.bak" ] && mv "$real.bak" "$real"
        [ -f "$geo.bak" ] && mv "$geo.bak" "$geo"
        exit 1
    fi
fi
echo "cf-ips: wrote $n4 IPv4 and $n6 IPv6 ranges"
