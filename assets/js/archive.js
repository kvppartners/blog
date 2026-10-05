// Archive page (layouts/archive.html): the search box filters the forms by their name in the
// page language, their Korean name or a code in it, and hides the groups with no match.

const root = document.getElementById('archive');
if (root) archive(root);

function archive(page) {
    const input = document.getElementById('ar-search');
    const count = document.getElementById('ar-count');
    const empty = document.getElementById('ar-empty');
    const forms = [...page.querySelectorAll('.ar-form')];
    const groups = [...page.querySelectorAll('.ar-group')];
    const jumps = [...page.querySelectorAll('.ar-jump a')];
    // Letters and digits only, so "F-1-5", "f15" and "F 1 5" find the same forms.
    const squash = (value) => value.toLowerCase().replace(/[\s\-‐–—_.,()[\]·:/]+/g, '');
    const keys = forms.map((form) => squash(form.dataset.search));

    function update() {
        const words = input.value.trim().split(/\s+/).map(squash).filter(Boolean);
        let shown = 0;
        forms.forEach((form, i) => {
            form.hidden = !words.every((word) => keys[i].includes(word));
            if (!form.hidden) shown += 1;
        });
        groups.forEach((group, i) => {
            const n = group.querySelectorAll('.ar-form:not([hidden])').length;
            group.hidden = n === 0;
            jumps[i].hidden = n === 0;
            jumps[i].querySelector('span').textContent = n;
        });
        count.textContent = page.dataset.count.replace('{n}', shown);
        empty.hidden = shown > 0;
    }

    input.addEventListener('input', update);
    // A link to one form (#its-id) shows it even if a search had hidden it.
    window.addEventListener('hashchange', () => {
        if (input.value) {
            input.value = '';
            update();
            document.getElementById(location.hash.slice(1))?.scrollIntoView();
        }
    });
}
