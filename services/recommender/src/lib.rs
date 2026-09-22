use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Deserialize)]
pub struct Product {
    pub id: String,
    pub category: String,
    pub price: u32,
    pub available: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Combo {
    pub side_id: String,
    pub drink_id: String,
    pub discount: u32,
}
#[derive(Deserialize)]
pub struct Catalog {
    pub products: Vec<Product>,
    pub combo: Combo,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub product_id: String,
    pub quantity: u32,
    pub combo: bool,
}
#[derive(Deserialize)]
pub struct Request {
    pub catalog: Catalog,
    pub items: Vec<Item>,
}
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Offer {
    pub product_id: String,
    pub kind: &'static str,
    pub reason: &'static str,
    pub price: u32,
    pub score: u32,
    pub item_index: Option<usize>,
}
#[derive(Serialize)]
pub struct Response {
    pub source: &'static str,
    pub offers: Vec<Offer>,
}

// Deterministic, explainable merchandising rules. No personal data, LLM, or invented conversion metrics.
pub fn recommend(req: &Request) -> Response {
    let mut ids: HashSet<&str> = HashSet::new();
    let mut categories: HashSet<&str> = HashSet::new();
    for item in &req.items {
        if item.quantity == 0 {
            continue;
        }
        ids.insert(item.product_id.as_str());
        if let Some(p) = req
            .catalog
            .products
            .iter()
            .find(|p| p.id == item.product_id)
        {
            categories.insert(p.category.as_str());
        }
        if item.combo {
            ids.insert(&req.catalog.combo.side_id);
            ids.insert(&req.catalog.combo.drink_id);
            categories.insert("sides");
            categories.insert("drinks");
        }
    }
    let mut offers = Vec::new();
    let side = req
        .catalog
        .products
        .iter()
        .find(|p| p.id == req.catalog.combo.side_id && p.available);
    let drink = req
        .catalog
        .products
        .iter()
        .find(|p| p.id == req.catalog.combo.drink_id && p.available);
    if let (Some(side), Some(drink)) = (side, drink)
        && !categories.contains("sides")
        && !categories.contains("drinks")
        && let Some((i, item)) = req.items.iter().enumerate().find(|(_, item)| {
            item.quantity > 0
                && !item.combo
                && req
                    .catalog
                    .products
                    .iter()
                    .any(|p| p.id == item.product_id && p.available && p.category == "burgers")
        })
    {
        offers.push(Offer {
            product_id: item.product_id.clone(),
            kind: "combo",
            reason: "Фри + кола. Вместе выгоднее",
            price: (side.price + drink.price).saturating_sub(req.catalog.combo.discount),
            score: 100,
            item_index: Some(i),
        });
    }
    for p in &req.catalog.products {
        if !p.available || ids.contains(p.id.as_str()) {
            continue;
        }
        let (score, reason) = match p.category.as_str() {
            "drinks" if categories.contains("burgers") && !categories.contains("drinks") => {
                (90, "Освежающая пара к вашему бургеру")
            }
            "sides" if categories.contains("burgers") && !categories.contains("sides") => {
                (85, "Добавьте немного хруста")
            }
            "burgers" if !categories.contains("burgers") => (70, "Начните с главного"),
            _ => continue,
        };
        offers.push(Offer {
            product_id: p.id.clone(),
            kind: "add",
            reason,
            price: p.price,
            score,
            item_index: None,
        });
    }
    offers.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then(a.price.cmp(&b.price))
            .then(a.product_id.cmp(&b.product_id))
    });
    offers.truncate(2);
    Response {
        source: "rust-rules-v1",
        offers,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn request(items: Vec<Item>) -> Request {
        Request {
            catalog: Catalog {
                products: vec![
                    Product {
                        id: "burger".into(),
                        category: "burgers".into(),
                        price: 34900,
                        available: true,
                    },
                    Product {
                        id: "fries".into(),
                        category: "sides".into(),
                        price: 14900,
                        available: true,
                    },
                    Product {
                        id: "cola".into(),
                        category: "drinks".into(),
                        price: 12900,
                        available: true,
                    },
                ],
                combo: Combo {
                    side_id: "fries".into(),
                    drink_id: "cola".into(),
                    discount: 7000,
                },
            },
            items,
        }
    }
    fn burger(combo: bool) -> Item {
        Item {
            product_id: "burger".into(),
            quantity: 1,
            combo,
        }
    }
    #[test]
    fn upgrades_burger_to_combo_first() {
        let out = recommend(&request(vec![burger(false)]));
        assert_eq!(out.offers[0].kind, "combo");
        assert_eq!(out.offers[0].price, 20800);
        assert_eq!(out.offers[0].item_index, Some(0));
    }
    #[test]
    fn never_recommends_components_already_in_combo() {
        assert!(recommend(&request(vec![burger(true)])).offers.is_empty());
    }
    #[test]
    fn unavailable_items_are_excluded() {
        let mut r = request(vec![burger(false)]);
        r.catalog.products[2].available = false;
        let out = recommend(&r);
        assert!(
            !out.offers
                .iter()
                .any(|o| o.product_id == "cola" || o.kind == "combo")
        );
    }
    #[test]
    fn no_combo_when_a_drink_is_already_present() {
        let r = request(vec![
            burger(false),
            Item {
                product_id: "cola".into(),
                quantity: 1,
                combo: false,
            },
        ]);
        let out = recommend(&r);
        assert_eq!(out.offers.len(), 1);
        assert_eq!(out.offers[0].product_id, "fries");
    }
    #[test]
    fn empty_basket_suggests_a_main() {
        assert_eq!(recommend(&request(vec![])).offers[0].product_id, "burger");
    }
}
