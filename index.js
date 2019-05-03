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

const getRecipeLinks = async (links) => {
    let recipes = [];
    for (link of links) {
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
                //if the link contains '/content/' skip it
                //make sure link is a full url
                recipes.push('https:' + element.firstChild.getAttribute('href'));
            }
            if (recipes.length > 100) {
                return recipes;
            }
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
            source: link
        };
        recipes.push(recipe);
        i += 1;
    }
    return recipes;
}

const writeRecipes = async (recipes) => {
    fs.writeFileSync('./recipes.json', JSON.stringify(recipes), 'utf-8');
}

const createCSVs = async () => {
    let recipesText = fs.readFileSync('./recipes.json');
    let json = JSON.parse(recipesText);
    let recipes = [];
    let directions = [];
    let ingredients = [];
    json.forEach((recipe, index) => {
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
    let fields = ['id', 'name', 'source'];
    const recipeCsv = parse(recipes, {fields});

    fields = ['recipeId', 'ingredient'];
    const ingredientCsv = parse(ingredients, {fields});

    fields = ['recipeId', 'direction'];
    const directionCsv = parse(directions, {fields});

    fs.writeFileSync('./recipes.csv', recipeCsv, 'utf-8');
    fs.writeFileSync('./ingredients.csv', ingredientCsv, 'utf-8');
    fs.writeFileSync('./directions.csv', directionCsv, 'utf-8');


}

(async () => {
    // console.log('getting links');
    // const links = await getCategoryLinks();
    // console.log('getting recipe links');
    // const recipeLinks = await getRecipeLinks(links);
    // console.log('getting recipes');
    // const recipes = await getRecipes(recipeLinks);
    // console.log('writing recipes');
    // writeRecipes(recipes);
    console.log('converting recipes to json');
    await createCSVs();
})();