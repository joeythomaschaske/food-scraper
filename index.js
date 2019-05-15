const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const { parse } = require('json2csv');

const getCategoryLinks = async () => {
    const main = await fetch('https://www.foodnetwork.com/recipes/recipes-a-z');
    const body = await main.text();
    const document = new JSDOM(body).window.document;
    const linkElements = document.getElementsByClassName('o-IndexPagination__a-Button ');
    let links = [];
    for (link of linkElements) {
        links.push('https:' + link.getAttribute("href"));
    }
    return links;
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
        if (recipes.length > 100) {
            return recipes;
        }
    }

    return recipes;
};

const getRecipes = async (links) => {
    let recipes = [];
    let i = 1;
    let total = links.length;
    for (link of links) {
        //add random pauses here to be a "nice" bot
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
        i += 1;
    }
    return recipes;
}

const createCSVs = async (recipeJson, category) => {
    let recipes = [];
    let directions = [];
    let ingredients = [];
    recipeJson.forEach((recipe, index) => {
        recipes.push({
            id: index,
            name: recipe.name.replace(/(?:\r\n|\r|\n)/g, '').trim(),
            source: recipe.source.replace(/(?:\r\n|\r|\n)/g, '').trim()
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
    fs.mkdirSync('./recipes/' + category);
    fs.writeFileSync('./recipes/' + category + '/recipes.csv', recipeCsv, 'utf-8');
    fs.writeFileSync('./recipes/' + category + '/ingredients.csv', ingredientCsv, 'utf-8');
    fs.writeFileSync('./recipes/' + category + '/directions.csv', directionCsv, 'utf-8');
}

(async () => {
    console.log('getting links');
    const links = await getCategoryLinks();
    for (link of links) {
        const savedLink = link;
        console.log('getting recipe links');
        const recipeLinks = await getRecipeLinks(link);
        console.log('getting recipes');
        const recipes = await getRecipes(recipeLinks);
        console.log('converting recipes to json');
        const urlSections = savedLink.split('/');
        const category = urlSections[urlSections.length - 1];
        await createCSVs(recipes, category);
    }
})();