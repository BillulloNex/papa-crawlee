FROM apify/actor-node-playwright-chrome:24 AS builder
USER root
WORKDIR /app
COPY package*.json ./
RUN npm install --include=dev --audit=false
COPY . ./
RUN npm run build

FROM apify/actor-node-playwright-chrome:24
USER root
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm --quiet set progress=false && npm install --omit=dev && echo "Installed" && node --version
COPY . ./
RUN chown -R myuser:myuser /app
USER myuser
EXPOSE 3000
CMD ["npm", "start"]
