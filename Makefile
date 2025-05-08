# Makefile for Scopely Test Project

# Run tests in Docker with automatic exit on failure or success
test:
	docker compose -f docker/docker-compose.test.yml up --abort-on-container-exit test-app

# Clean up containers and networks after test or dev execution
dev-down:
	docker compose -f docker/docker-compose.dev.yml down

# Rebuild the containers (useful if you change Dockerfiles or dependencies)
dev-rebuild:
	docker compose -f docker/docker-compose.dev.yml up --build --force-recreate app

# Start the app service (in dev mode)
dev-start:
	docker compose -f docker/docker-compose.dev.yml up --build app worker

# Stop the containers without removing them
dev-stop:
	docker compose -f docker/docker-compose.dev.yml stop

# View logs from the app service
dev-logs:
	docker compose -f docker/docker-compose.dev.yml logs -f app

