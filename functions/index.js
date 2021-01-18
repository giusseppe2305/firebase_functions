
const functions = require('firebase-functions');
const express = require('express')
const admin = require('firebase-admin');
const { snapshotConstructor } = require('firebase-functions/lib/providers/firestore');



const app = express();


admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://projecto-final-b5adb.firebaseio.com"
});
const db = admin.firestore();
app.get('/hello-world', (req, res) => {

    res.status(200).json({ message: 'hola mundo' })
})

app.get('/api/items/:producto_id', (req, resp) => {
    (async () => {
        try {
            const doc = db.collection('Users').doc(req.params.producto_id);
            const item = await doc.get();
            const response = item.data();
            return resp.status(200).json(response);

        } catch (error) {
            return resp.status(500).send(error);
        }
    })();
})
app.get('/professional/:category/:own_id', async (request, response) => {
    const professionals = db.collection('Users').where('professional', '==', true);
    let query = professionals;
    const order = request.query.orderby;
    const start = request.query.price_start;
    const end = request.query.price_end;
    const last_conexion = request.query.last_conexion;
    const price = start != null && end != null;

    if (last_conexion != null) {
        const nowDate = new Date();
        const nowLong = nowDate.getTime();
        let compare = null;
        console.log('last ' + last_conexion + "/");
        switch (last_conexion) {
            case "0":
                compare = nowDate.setDate(nowDate.getDate() - 1);
                break;
            case "1":
                compare = nowDate.setDate(nowDate.getDate() - 3);

                break;
            case "2":
                compare = nowDate.setDate(nowDate.getDate() - 7);
                break;
            case "3":
                compare = nowDate.setDate(nowDate.getDate() - 30);
                break;
            default:
                compare = null;
                break;
        }
        if (compare != null) {
            console.log(nowLong);
            console.log(compare);
            query = professionals.where('lastConnection', '<=', nowLong).where('lastConnection', '>=', compare);

            let prueba = await query.get();

            prueba.docs.forEach(function (v, i, a) {
                console.log(v.data().id);
            })

        }

    }

    const result = await query.get();
    let list = result.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
    }));
    //delete worker own id
    list = list.filter(doc => {
        if (doc.id == request.params.own_id)
            return false;
        else
            return true;
    });

    let listResult = new Array();
    const allAsyncResults = [];
    list.forEach(function (value, ind, array) {
        const asnycResult = cargar(listResult, value);
        allAsyncResults.push(asnycResult)
    });
    await Promise.all(allAsyncResults);
    //filter by category
    if (request.params.category != -1) {
        listResult = listResult.filter(function (obj) {
            let valueFilter = false;
            if (obj.skills != null) {
                obj
                obj.skills.forEach(function (value, ind, array) {
                    if (value.idCategory == request.params.category) {
                        valueFilter = true;
                    }
                });
            }
            return valueFilter;
        });
    }



    if (order != null) {
        if (order == 0) {
            listResult = listResult.sort(function (a, b) {
                if (a.timestamp > b.timestamp) {
                    return 1;
                }
                if (a.timestamp < b.timestamp) {
                    return -1;
                }

                return 0;
            });
        } else if (order == 1) {
            listResult = listResult.sort(function (a, b) {
                if (a.timestamp > b.timestamp) {
                    return 1;
                }
                if (a.timestamp < b.timestamp) {
                    return -1;
                }
                return 0;
            }).reverse();
        } else if (order == 2) {
            listResult = listResult.sort(function (a, b) {
                if (a.price > b.price) {
                    return 1;
                }
                if (a.price < b.price) {
                    return -1;
                }
                return 0;
            });
        } else if (order == 3) {
            listResult = listResult.sort(function (a, b) {
                if (a.price > b.price) {
                    return 1;
                }
                if (a.price < b.price) {
                    return -1;
                }
                return 0;
            }).reverse();
        }

    }


    if (price) {
        listResult = listResult.filter(function (obj) {
            if (obj != null) {
                if (obj.price >= start && obj.price <= end) {
                    return true;
                }
            }
            return false;
        });
    }
    //pagination


    response.status(200).json(listResult);

});

app.get('/jobs/:job_start', async (req, res) => {
    try {
        const snap = await db.collection('Jobs').doc(req.params.job_start).get();
        const query = db.collection('Jobs').orderBy('timestamp', 'desc').startAfter(snap).limit(5);
        const querySnapshot = await query.get();
        const docs = querySnapshot.docs;
        const response = docs.map(doc => ({
            id: doc.id,
            data: doc.data()
        }))
        return res.status(200).json(response);
    } catch (error) {
        return res.status(500).json(error);
    }
});


app.get('/jobs/averagePrice/:id_job', async (req, res) => {
    try {
        const snap = await db.collection('ApplyWorkers').where("idJob", "==", req.params.id_job).get();
        let average = 0;
        let dev;
        if (snap.docs.length > 0) {
            snap.docs.forEach(function (v, i, a) {
                average = v.data().price;
            });
            dev = {
                "count": snap.docs.length,
                "average": (average / snap.docs.length)
            };
        } else {
            dev = {
                "count": 0,
                "average": 0
            };
        }

        return res.status(200).json(dev);
    } catch (error) {
        return res.status(500).json(error);
    }
});
function typeOf(obj) {
    return {}.toString.call(obj).split(' ')[1].slice(0, -1).toLowerCase();
}
async function cargar(listResult, value) {
    let average = 0;
    if (value.data.skills != null) {
        value.data.skills.forEach(function (v, i, a) {
            average += parseFloat(v.pricePerHour);
        });
        average = (average / value.data.skills.length);
    } else {
        average = null;
    }
    const jobResult = await db.collection('Jobs').where('state', '==', 'FINISHED').where('idUserApply', '==', value.id).get();

    const jobs = jobResult.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
    }));

    let averageValuation=0;
    let totalValuations=0;
    if (jobs != null) {

        jobs.forEach(function (v, i, a) {
            if (v.data.valuation != null) {
                totalValuations++;
                let averageValuationSingle = v.data.valuation.amiability +
                    v.data.valuation.punctuality +
                    v.data.valuation.speedContact +
                    v.data.valuation.speedEndJob;
                    averageValuation += averageValuationSingle / 4;

            }
        });
       
        averageValuation=averageValuation/totalValuations;
        if(isNaN(averageValuation)){
            averageValuation=0;
        }
    }

    let pushItem = {
        "id": value.id,
        "profileImage": value.data.profileImage,
        "name": value.data.name,
        "lastName": value.data.lastName,
        "price": average,
        "about": value.data.about,
        "timestamp": value.data.timestamp,
        "averageValuation": averageValuation,
        "skills": value.data.skills,
        "lastConnection": value.data.lastConnection
    };

    listResult.push(pushItem);
}
exports.app = functions.https.onRequest(app);


