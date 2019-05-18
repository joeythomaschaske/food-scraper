const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const { parse } = require('json2csv');

const getCategoryLinks = async () => {
    const main = await fetch('https://www.foodnetwork.com/recipes/recipes-a-z');
    return [
        //'https://www.foodnetwork.com/recipes/recipes-a-z/123',
        //'https://www.foodnetwork.com/recipes/recipes-a-z/a',
        //'https://www.foodnetwork.com/recipes/recipes-a-z/b',
        'https://www.foodnetwork.com/recipes/recipes-a-z/c',
        'https://www.foodnetwork.com/recipes/recipes-a-z/d',
        'https://www.foodnetwork.com/recipes/recipes-a-z/e',
        'https://www.foodnetwork.com/recipes/recipes-a-z/f',
        'https://www.foodnetwork.com/recipes/recipes-a-z/g',
        'https://www.foodnetwork.com/recipes/recipes-a-z/h',
        'https://www.foodnetwork.com/recipes/recipes-a-z/i',
        'https://www.foodnetwork.com/recipes/recipes-a-z/j',
        'https://www.foodnetwork.com/recipes/recipes-a-z/k',
        'https://www.foodnetwork.com/recipes/recipes-a-z/l',
        'https://www.foodnetwork.com/recipes/recipes-a-z/m',
        'https://www.foodnetwork.com/recipes/recipes-a-z/n',
        'https://www.foodnetwork.com/recipes/recipes-a-z/o',
        'https://www.foodnetwork.com/recipes/recipes-a-z/p',
        'https://www.foodnetwork.com/recipes/recipes-a-z/q',
        'https://www.foodnetwork.com/recipes/recipes-a-z/r',
        'https://www.foodnetwork.com/recipes/recipes-a-z/s',
        'https://www.foodnetwork.com/recipes/recipes-a-z/t',
        'https://www.foodnetwork.com/recipes/recipes-a-z/u',
        'https://www.foodnetwork.com/recipes/recipes-a-z/v',
        'https://www.foodnetwork.com/recipes/recipes-a-z/w',
        'https://www.foodnetwork.com/recipes/recipes-a-z/xyz'
    ]
};

const getRecipeLinks = async (link) => {
    let recipes = [];
    let allPagesScraped = false;
    for (let i = 1; !allPagesScraped; i++) {
        const page = link + '/p/' + i;
        console.log('fetching: ' + page);
        const main = await fetch(page);
        const body = await main.text();
        const document = new JSDOM(body).window.document;
        const recipeElements = document.getElementsByClassName('m-PromoList__a-ListItem');
        if (recipeElements.length == 0) {
            allPagesScraped = true;
        }
        for (element of recipeElements) {
            const link = element.firstChild.getAttribute('href');
            if (!link.includes('/content/')) {
                recipes.push('https:' + element.firstChild.getAttribute('href'));
            }
        }
    }

    return recipes;
};

const pauseAndWait = (maxTime, minTime) => {
    return new Promise((acc, rej) => {
        const randomTime = Math.random() * (maxTime - minTime) + minTime;
        console.log('waiting ' + (randomTime/1000) + 's');
        setTimeout(() => {
            console.log('')
            acc();
        }, randomTime);
    });
}

const getRecipes = async (links, category) => {
    let recipes = [];
    let i = 1;
    let total = links.length;
    for (link of links) {
        try {
            //add random pauses here to be a "nice" bot
            //await pauseAndWait(5000, 1000);
            console.log('fetching: ' + link + '\n' + Math.round(((i/total) * 100)) + '%');
            const main = await fetch(link);
            const body = await main.text();
            const document = new JSDOM(body).window.document;
            const rawTitle = document.getElementsByClassName('o-AssetTitle')[0];
            const rawIngredients = document.getElementsByClassName('o-Ingredients__a-Ingredient');
            const rawDirections = document.getElementsByClassName('o-Method__m-Step');
            let rawImage = document.getElementsByClassName('o-RecipeLead')[0].getElementsByClassName('m-MediaBlock__a-Image a-Image')[0];
            if (rawImage) {
                rawImage = 'https:' + rawImage.getAttribute('src');
            }
            let ingredients = [];
            let directions = [];

            for (ingredient of rawIngredients) {
                ingredients.push(ingredient.textContent);
            }
            for (direction of rawDirections) {
                directions.push(direction.textContent);
            }

            let recipe = {
                name : rawTitle.textContent,
                ingredients : ingredients,
                directions: directions,
                source: link,
                imgSrc: rawImage
            };
            recipes.push(recipe);
            if (i % 20 == 0) {
                console.log('converting recipes to json');
                await createCSVs(recipes, category, Math.round(i/20));
                recipes = [];
            }
            i += 1;
        } catch(e) {
            console.log('error parsing: ' + link);
        }
    }
    await createCSVs(recipes, category, Math.round(i/20));
}

const createCSVs = async (recipeJson, category, chunk) => {
    let recipes = [];
    let directions = [];
    let ingredients = [];
    recipeJson.forEach((recipe, index) => {
        recipes.push({
            id: index,
            name: recipe.name.replace(/(?:\r\n|\r|\n)/g, '').trim(),
            source: recipe.source.replace(/(?:\r\n|\r|\n)/g, '').trim(),
            imgSrc: recipe.imgSrc ? recipe.imgSrc.replace(/(?:\r\n|\r|\n)/g, '').trim() : ''
        });

        recipe.ingredients.forEach((ingredient) => {
            ingredients.push({
                recipeId: index,
                ingredient: ingredient.replace(/(?:\r\n|\r|\n)/g, '').trim()
            });
        });

        recipe.directions.forEach((direction) => {
            directions.push({
                recipeId: index,
                direction: direction.replace(/(?:\r\n|\r|\n)/g, '').trim()
            });
        });
    });
    let fields = ['id', 'name', 'source', 'imageSrc'];
    const recipeCsv = parse(recipes, {fields});

    fields = ['recipeId', 'ingredient'];
    const ingredientCsv = parse(ingredients, {fields});

    fields = ['recipeId', 'direction'];
    const directionCsv = parse(directions, {fields});

    //make file here for category links
    if (!fs.existsSync('./recipes/' + category)) {
        fs.mkdirSync('./recipes/' + category);
    }
    fs.writeFileSync('./recipes/' + category + '/recipes' + '-' + chunk +'.csv', recipeCsv, 'utf-8');
    fs.writeFileSync('./recipes/' + category + '/ingredients' + '-' + chunk +'.csv', ingredientCsv, 'utf-8');
    fs.writeFileSync('./recipes/' + category + '/directions' + '-' + chunk +'.csv', directionCsv, 'utf-8');
}

(async () => {
    console.log('getting links');
    const links = await getCategoryLinks();
    for (link of links) {
        const savedLink = link;
        const urlSections = savedLink.split('/');
        const category = urlSections[urlSections.length - 1];

        console.log('getting recipe links');
        const recipeLinks = await getRecipeLinks(link);
        console.log('getting recipes');
        await getRecipes(recipeLinks, category);
        await pauseAndWait(900000, 900000);
    }
})();