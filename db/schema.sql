-- Recipe Finder database schema (MySQL)
-- Applied automatically at server startup by db/init.js (ensureSchema()).

CREATE TABLE IF NOT EXISTS recipes (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    title         VARCHAR(255)  NOT NULL,
    slug          VARCHAR(255)  NOT NULL,
    instructions  TEXT          NOT NULL,
    prep_time     INT           NULL,               -- minutes
    image         VARCHAR(500)  DEFAULT '/uploads/default.png',
    approved      TINYINT(1)    NOT NULL DEFAULT 0,  -- 0 = pending moderation, 1 = live
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_recipes_slug (slug),
    KEY idx_recipes_approved (approved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ingredients (
    id    INT AUTO_INCREMENT PRIMARY KEY,
    name  VARCHAR(150) NOT NULL,
    UNIQUE KEY uniq_ingredients_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    recipe_id     INT NOT NULL,
    ingredient_id INT NOT NULL,
    amount        VARCHAR(50),
    unit          VARCHAR(50),
    PRIMARY KEY (recipe_id, ingredient_id),
    CONSTRAINT fk_ri_recipe     FOREIGN KEY (recipe_id)     REFERENCES recipes(id)     ON DELETE CASCADE,
    CONSTRAINT fk_ri_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS help_requests (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(150) NOT NULL,
    email      VARCHAR(180) NOT NULL,
    problem    TEXT         NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
