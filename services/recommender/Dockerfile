FROM rust:1.93-slim-bookworm AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src/ ./src/
RUN cargo build --release --locked

FROM debian:bookworm-slim
RUN useradd --system --uid 10001 biteos
COPY --from=build /src/target/release/biteos-recommender /usr/local/bin/biteos-recommender
USER biteos
ENV ENGINE_ADDR=0.0.0.0:8091
EXPOSE 8091
CMD ["biteos-recommender"]
