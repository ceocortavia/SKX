DB ?= $(DATABASE_URL_UNPOOLED)

migrate:
	@for f in $$(ls -1 db/migrations/*.sql | sort); do \
		echo "==> $$f"; psql "$(DB)" -v ON_ERROR_STOP=1 -f "$$f"; \
	done

verify:
	@psql "$(DB)" -v ON_ERROR_STOP=1 -a -P pager=off -f db/tests/199_final_verification.sql


