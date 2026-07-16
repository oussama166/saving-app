#!/bin/bash

# 1. On se déplace dans le dossier (et on coupe le script si le dossier n'existe pas)
cd /Users/mac/Devs/saving || exit

# 2. On lance Next.js en arrière-plan avec le symbole "&"
npm run dev &

# 3. On sauvegarde l'ID du processus npm (PID)
NPM_PID=$!

# 4. On s'assure de couper npm quand on quitte Ngrok (Ctrl+C) pour éviter de bloquer le port 3000
trap "kill $NPM_PID" EXIT

# 5. On lance Ngrok au premier plan
ngrok http 3000