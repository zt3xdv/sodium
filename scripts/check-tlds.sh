#!/bin/bash

DOMAIN="axiomsys"

TLDS=(
  "com" "net" "org" "io" "co" "me" "dev" "app" "xyz" "info"
  "tech" "online" "site" "website" "cloud" "digital" "systems"
  "solutions" "services" "network" "space" "zone" "pro" "biz"
  "ai" "sh" "cc" "tv" "us" "uk" "de" "es" "fr" "it" "nl" "eu"
  "in" "ca" "au" "nz" "jp" "kr" "cn" "ru" "br" "mx" "ar"
  "name" "id" "page" "link" "live" "blog" "email" "one" "run"
)

echo "Probando TLDs para: $DOMAIN"
echo "================================"

for tld in "${TLDS[@]}"; do
  full="$DOMAIN.$tld"
  # Intentar resolver DNS
  if host "$full" &>/dev/null; then
    echo "✓ $full - ACTIVO"
  else
    echo "✗ $full"
  fi
done
