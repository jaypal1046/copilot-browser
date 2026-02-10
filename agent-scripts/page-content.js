
      ({
        title: document.title,
        headings: Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.textContent.trim()),
        links: Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent.trim(),
          href: a.href
        })),
        paragraphs: Array.from(document.querySelectorAll('p')).map(p => p.textContent.trim()),
        images: Array.from(document.querySelectorAll('img')).map(img => img.src),
        forms: Array.from(document.querySelectorAll('form')).length,
        buttons: Array.from(document.querySelectorAll('button')).length
      })
    