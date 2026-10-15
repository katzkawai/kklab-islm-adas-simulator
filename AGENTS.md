# Repository Guidelines

## Project Structure & Module Organization

This repository is a Japanese educational IS-LM / AD-AS simulator published through GitHub Pages.

- `index.html` contains the entire application: markup, styles, model equations, equilibrium solvers, presets, and Plotly rendering.
- `README.md` describes the model, learning goals, and published resources.
- `textbook.tex` is the Japanese LuaLaTeX teaching material; `textbook.pdf` is its tracked output.
- `images/` holds simulator screenshots used by the textbook, such as `sim_preset_2013.png`.

There are no separate source, test, or bundled asset directories. Tailwind CSS, Plotly, KaTeX, and fonts load from external services.

## Build, Test, and Development Commands

- `python3 -m http.server 8000`: serve the repository locally; open `http://localhost:8000/`. Internet access is needed for external dependencies.
- `lualatex -interaction=nonstopmode -halt-on-error textbook.tex`: rebuild the textbook with a Japanese-capable TeX installation. Run twice to resolve references and review the resulting PDF.
- `git diff --check`: check patches for whitespace errors before committing.

The web application requires no build step, package installation, or backend. No npm scripts, formatter, linter, or automated test framework are configured.

## Coding Style & Naming Conventions

Follow the existing two-space indentation increments in HTML, CSS, and JavaScript. Use JavaScript semicolons, single-quoted strings, and `const` unless reassignment requires `let`. Functions use descriptive camelCase names, such as `solveFullEquilibrium`; shared configuration uses uppercase names such as `ECON` and `PRESETS`. Preserve established economic symbols such as `Y`, `P`, and `I0`.

Keep user-facing explanations in Japanese and mathematical notation consistent across the simulator, README, and textbook. Follow the `sim_*.png` pattern for screenshots.

## Testing Guidelines

Validation is currently manual; no test naming convention or coverage threshold exists. Check all three historical presets, standard reset, every slider, baseline locking, lower-chart view switching, and responsive resizing. Verify chart and indicator updates, KaTeX rendering, the PDF link, and browser-console errors.

For equation changes, check the Fisher relation `r = i - pie`, the liquidity-trap behavior, and agreement with textbook explanations. Record the scenarios checked in the pull request.

## Commit & Pull Request Guidelines

Existing commits use concise imperative English subjects, such as `Render LaTeX math expressions with KaTeX`. Follow that style and keep changes focused.

Pull requests should explain the change and its educational or numerical impact, list validation performed, and link related issues when applicable. Include screenshots for visible changes. When changing teaching material, update the tracked PDF and affected screenshots alongside their sources.
