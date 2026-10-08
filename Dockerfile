FROM node:22.8.0

WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Install ts-node-dev globally for hot reload (optional if used in package.json)
RUN npm install -g ts-node-dev

# Same entrypoint as the dev image: applies pending migrations, then runs CMD
COPY docker-entrypoint.dev.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
  && chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port
EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
# Start the app in dev mode (with hot reload)
CMD ["npm", "run", "start:dev"]
