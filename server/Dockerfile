# ===== Serveur Versus 1v1 LogPose — conteneur VPS =====
# Contexte de build attendu : un dossier contenant
#   Dockerfile (copié depuis server/), data.json, js/versus-rules.js,
#   server/versus-server.js, server/package.json
# (mêmes chemins relatifs qu'en dev : le serveur require ../js/versus-rules.js
#  et lit ../data.json en fallback froid — voir BRIEF_V6 §2.6)
#
# Build : sudo docker build -t logpose-versus .
# Run   : sudo docker run -d --name versus --restart unless-stopped \
#           --network clutch-backend_default -p 127.0.0.1:8765:8765 logpose-versus
# (réseau partagé avec le Caddy du VPS → reverse_proxy versus:8765 ;
#  le port 127.0.0.1 ne sert qu'aux checks /health depuis l'hôte)

FROM node:24-alpine

WORKDIR /app/server
COPY server/package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY server/versus-server.js ./
COPY js/versus-rules.js /app/js/versus-rules.js
COPY data.json /app/data.json

# Dans un conteneur il faut écouter sur l'interface du conteneur, pas 127.0.0.1
ENV VERSUS_HOST=0.0.0.0
EXPOSE 8765

USER node
CMD ["node", "versus-server.js"]
