FROM node:20-alpine AS build
WORKDIR /frontend

COPY package.json package-lock.json* ./
# если lock есть и актуален — ci, если нет/битый — install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]