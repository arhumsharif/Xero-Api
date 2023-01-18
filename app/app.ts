require("dotenv").config();
var cookieParser = require('cookie-parser');
var nodemailer = require('nodemailer');
import { rejects } from "assert";
import { promises } from "dns";
import express, { response } from "express";
import { Request, Response } from "express";
import jwtDecode from "jwt-decode";
import { TokenSet } from "openid-client";
import {
  XeroAccessToken,
  XeroIdToken,
  XeroClient,
  Contact,
  LineItem,
  Invoice,
  Invoices,
  Phone,
  Contacts,
  Currencies,
  CurrencyCode,
  AccountType,
  Account,
} from "xero-node";

const session = require("express-session");


  // make xero Object
  let xeroOne = new XeroClient();

// const client_id: string = "4DDEE1DCDA9D44568B71A5E0515EF606"; // arhum id
// const client_secret: string = "NZABPl-oAjijrnpXmnvuLDj6ofz5nwFugDtmIagOHsysIbG3"; // arhum secret

const client_id: string = "4DDEE1DCDA9D44568B71A5E0515EF606"; // user id
const client_secret: string = "NZABPl-oAjijrnpXmnvuLDj6ofz5nwFugDtmIagOHsysIbG3";  // user secret


const redirectUrl: string = "https://ironmotorsportsxero-hmwty.ondigitalocean.app/callback";
const scopes: string =
  "openid profile email accounting.settings accounting.reports.read accounting.journals.read accounting.contacts accounting.attachments accounting.transactions offline_access";

const xero = new XeroClient({
  clientId: client_id,
  clientSecret: client_secret,
  redirectUris: [redirectUrl],
  scopes: scopes.split(" "),
});

if (!client_id || !client_secret || !redirectUrl) {
  throw Error(
    "Environment Variables not all set - please check your .env file in the project root or create one!"
  );
}

const app: express.Application = express();

app.use(express.static(__dirname + "/build"));

app.use(
  session({
    secret: "something crazy",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.use(cookieParser());

const authenticationData: any = (req: Request, res: Response) => {
  return {
    decodedIdToken: req.session.decodedIdToken,
    decodedAccessToken: req.session.decodedAccessToken,
    tokenSet: req.session.tokenSet,
    allTenants: req.session.allTenants,
    activeTenant: req.session.activeTenant,
  };
};

// Nodemailer function
const sendEmail = (receiver, subject, text) => {
  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'ironmotorsports10@gmail.com',
      pass: 'ithnzpnvbozgbahx'
    }
  });
  
  var mailOptions = {
    from: 'ironmotorsports10@gmail.com',
    to: receiver,
    subject: subject,
    text: text
  };
  
  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}


const intiateXeroObject = (id, secret, url) => {
  const client_id: string = id; // user id
  const client_secret: string = secret;  // user secret
  const redirectUrl: string = "https://ironmotorsportsxero-hmwty.ondigitalocean.app/callback";
  const scopes: string =
    "openid profile email accounting.settings accounting.reports.read accounting.journals.read accounting.contacts accounting.attachments accounting.transactions offline_access";

  const xeroNew = new XeroClient({
    clientId: client_id,
    clientSecret: client_secret,
    redirectUris: [redirectUrl],
    scopes: scopes.split(" "),
  });

  if (!client_id || !client_secret || !redirectUrl) {
    throw Error(
      "Environment Variables not all set - please check your .env file in the project root or create one!"
    );
  }
  return xeroNew
}

app.get("/", (req: Request, res: Response) => {
  res.send(`<a href='/connect'>Connect to Xero</a>`);
});

app.get("/connect", async (req: Request, res: Response) => {
  // get credentials
  let clientId = req.cookies.clientId
  let clientSecret = req.cookies.clientSecret
  let redirectUrl = req.cookies.redirectUrl
  xeroOne = intiateXeroObject(clientId, clientSecret, redirectUrl);

  try {
    const consentUrl: string = await xeroOne.buildConsentUrl();
    res.redirect(consentUrl);
  } catch (err) {
    res.send("Sorry, something went wrong");
  }
});

app.get("/callback", async (req: Request, res: Response) => {
  try {
    const tokenSet: TokenSet = await xeroOne.apiCallback(req.url);
    await xeroOne.updateTenants();

    const decodedIdToken: XeroIdToken = jwtDecode(tokenSet.id_token);
    const decodedAccessToken: XeroAccessToken = jwtDecode(
      tokenSet.access_token
    );

    console.log("Cookies::::")
    console.log(req.cookies)
    
    let status = req.cookies.xeroStatus

    req.session.decodedIdToken = decodedIdToken;
    req.session.decodedAccessToken = decodedAccessToken;
    req.session.tokenSet = tokenSet;
    req.session.allTenants = xeroOne.tenants;
    // XeroClient is sorting tenants behind the scenes so that most recent / active connection is at index 0
    req.session.activeTenant = xeroOne.tenants[0];

    const authData: any = authenticationData(req, res);

    console.log(authData);

    if (status == 1)
    {
      res.redirect("/contact");
    }
    else if (status == 2)
    {
      res.redirect("/save-invoice")
    }
    else
    {
      res.redirect("/invoices")
    }

  } catch (err) {
    res.send("Sorry, something went wrong" + err);
  }
});

app.get("/organisation", async (req: Request, res: Response) => {
  try {
    const tokenSet: TokenSet = await xeroOne.readTokenSet();
    console.log(tokenSet.expired() ? "expired" : "valid");
    const response: any = await xeroOne.accountingApi.getOrganisations(
      req.session.activeTenant.tenantId
    );
    res.send(`Hello, ${response.body.organisations[0].name}, ${req.session.activeTenant.tenantId}`);
  } catch (err) {
    res.send("Sorry, something went wrong");
  }
});

app.get("/contacts", async (req: Request, res: Response) => {
  try {
    const contacts = await xeroOne.accountingApi.getContacts(
      req.session.activeTenant.tenantId
    );
    console.log("contacts: ", contacts.body.contacts);
    res.send(contacts.body.contacts);
  } catch (err) {
    console.log("error", err);
  }
});

app.get("/create-accounts", async (req: Request, res: Response) => {
  let p = new Promise(async (resolve, rejects) => {
    try {
      const account: Account = {
        name: "Invoice",
        code: "invoice",
        type: AccountType.EXPENSE,
        hasAttachments: true,
      };
      const contacts = await xero.accountingApi.createAccount(
        req.session.activeTenant.tenantId,
        account
      );

      resolve(await contacts.body);
    } catch (err) {
      rejects(err);
    }
  });
  p.then((data) => {
    console.log(data);
    res.send(data);
  }).catch((data) => {
    res.json({ error: data });
  });
  //   const account2: Account = {
  //     name: "Card",
  //     code: "card",
  //     type: AccountType.EXPENSE,
  //     hasAttachments: true,
  //   };
  //   const contacts2 = await xero.accountingApi.createAccount(
  //     req.session.activeTenant.tenantId,
  //     account2
  //   );
  //   const account3: Account = {
  //     name: "Invoice",
  //     code: "invoice",
  //     type: AccountType.EXPENSE,
  //     hasAttachments: true,
  //   };
  //   const contacts3 = await xero.accountingApi.createAccount(
  //     req.session.activeTenant.tenantId,
  //     account3
  //   );

  //   res.send([
  //     contacts.body.accounts,
  //     contacts2.body.accounts,
  //     contacts3.body.accounts,
  //   ]);
});

app.get("/accounts", async (req: Request, res: Response) => {
  let where = 'Name=="Cash" OR Name=="Card" OR Name=="Invoice"';
  let ifModifiedSince = null;
  try {
    const contacts = await xero.accountingApi.getAccounts(
      req.session.activeTenant.tenantId,
      ifModifiedSince,
      where
    );
    console.log("contacts: ", contacts.body.accounts);
    res.send(contacts.body.accounts);
  } catch (err) {
    console.log("error", err);
  }
});

app.get("/invoice-pdf", async (req: Request, res: Response) => {
  let id = 'd8bd3eb4-c662-4913-9f54-b613f8736ff5'
  try {
    const response = await xero.accountingApi.getInvoiceAsPdf(
      req.session.activeTenant.tenantId, id
    );
    console.log(response.body || response.response.statusCode)
    res.send(response.body)
} catch (err) {
  const error = JSON.stringify(err.response.body, null, 2)
  console.log(`Status Code: ${err.response.statusCode} => ${error}`);
}
});

app.get("/save-invoice", async (req: Request, res: Response) => {
  let email = req.cookies.customerEmail
  let price = req.cookies.customerPrice
  let type = req.cookies.customerPayType
  let dueDate = req.cookies.customerDate
  let date: Date = new Date()
  var year = date.toLocaleString("default", { year: "numeric" });
  var month = date.toLocaleString("default", { month: "2-digit" });
  var day = date.toLocaleString("default", { day: "2-digit" });
  let todayDate = year + '-' + month + '-' + day
  let price_in_number = Number(price)
  let tax  = 0 // 8.25

  // get price from cookies as well
  let contacts_where = 'emailAddress=="' + email + '"';
  // let contacts_where = `emailAddress=='${email}'`;
  console.log(contacts_where)
  let ifModifiedSince = null;
  try {
    const contacts = await xeroOne.accountingApi.getContacts(
      req.session.activeTenant.tenantId,
      ifModifiedSince,
      contacts_where
    );
    console.log("contacts: ", contacts.body.contacts);
    // res.send(contacts.body.contacts[0]);

    //  we have the contact we want to save
    const contact: Contact = contacts.body.contacts[0]; //  const Currency :CurrencyCode = CurrencyCode.USD
    const lineItem: LineItem[] = [];
    lineItem.push({
      accountID: "ksdjkfj0-dkjkdjf-dfjkdfjfj",
    });
    //   lineItem.accountID =
    const invoice: Invoice[] = [
      {
        contact: contact,
        dueDate: dueDate,
        date: todayDate,
        subTotal: 900,
        totalTax: 0,
        total: 0 ,
        currencyCode: CurrencyCode.USD,
        type: Invoice.TypeEnum.ACCREC,
        lineItems: [
          {
          description: "Iron Motorsports",
          quantity: 1,
          unitAmount: price_in_number,
          accountCode: "200"
        },
      ],
        reference: "Website Design",
        status: Invoice.StatusEnum.DRAFT,
      },
    ];
    const invoices: Invoices = {
      invoices: invoice,
    };
    const response = await xeroOne.accountingApi.createInvoices(
      req.session.activeTenant.tenantId,
      invoices
    );
    // res.send(invoices.body.invoices);
    // Send Email
    let text = '\t\tYour Invoice has been generated\n\n---------------------------------------\nInvoice Account type: ' + type + ' \nCurrent Date: ' + todayDate + ' \nDue Date: ' + dueDate + ' \nPrice: ' + price + '\n\nThank You! \nRegards, \nIron Motorsports\n---------------------------------------'
    sendEmail(email, 'Invoice Generation From Iron Motorsports', text)
    res.redirect('https://ironmotorsportsapi-gbuda.ondigitalocean.app/find-jobs');
  } catch (err) {
    console.log(err.response.body.Elements[0].ValidationErrors[0].Message)
    // store the message in cookie
    res.cookie('xeroError', err.response.body.Elements[0].ValidationErrors[0].Message)
    res.redirect('https://ironmotorsportsapi-gbuda.ondigitalocean.app/find-jobs');
  }
});


app.get("/invoices", async (req: Request, res: Response) => {
  let price = req.cookies.customerPrice
  let newPrice = Number(price)
  let where = 'contact.contactID=="78b7299c-4f1f-46d2-acc3-44a46bd361b1"';
  let ifModifiedSince = null;
  try {
    const contacts = await xeroOne.accountingApi.getInvoices(
      req.session.activeTenant.tenantId,
      ifModifiedSince,
      );
      console.log("contacts: ", contacts.body.invoices);
      console.log(typeof(newPrice))
    res.send(contacts.body.invoices);
  } catch (err) {
    console.log("error", err);
  }
});

app.get("/invoice", async (req: Request, res: Response) => {
  let where = 'type=="ACCPAY"';
  let ifModifiedSince = null;
  try {
    const contacts = await xero.accountingApi.getContacts(
      req.session.activeTenant.tenantId,
      ifModifiedSince,
      where      
    );
    console.log("my contacts: ", contacts.body.contacts);
    const contact: Contact = contacts.body.contacts[0]; //  const Currency :CurrencyCode = CurrencyCode.USD
    const lineItem: LineItem[] = [];
    lineItem.push({
      accountID: "562555f2-8cde-4ce9-8203-0363922537a4",
    });
    //   lineItem.accountID =
    const invoice: Invoice[] = [
      {
        contact: contact,
        dueDate: "2021-09-25",
        date: "2021-09-24",
        subTotal: 123456,
        totalTax: 0,
        total: 0,
        currencyCode: CurrencyCode.USD,
        type: Invoice.TypeEnum.ACCREC,
        lineItems: lineItem,
        reference: "Website Design",
        status: Invoice.StatusEnum.DRAFT,
      },
    ];
    const invoices: Invoices = {
      invoices: invoice,
    };
    const response = await xero.accountingApi.createInvoices(
      req.session.activeTenant.tenantId,
      invoices
    );
    console.log("invoices: ", response.body.invoices);
    res.json(response.body.invoices);
  } catch (err) {
    res.json(err);
  }
});

app.get("/contact", async (req: Request, res: Response) => {
  try {
    let name = req.cookies.customerName
    let phone = req.cookies.customerPhone
    let email = req.cookies.customerEmail
    const contact: Contact = {
      name: name,
      emailAddress: email,
      phones: [
        {
          phoneNumber: phone,
          phoneType: Phone.PhoneTypeEnum.MOBILE,
        },
      ],
    };
    const contacts: Contacts = {
      contacts: [contact],
    };
    console.log("Tenat ID:", req.session.activeTenant.tenantId)
    const response = await xeroOne.accountingApi.createContacts(
      req.session.activeTenant.tenantId,
      contacts
      );
      console.log("contacts: ", response.body.contacts);
    res.redirect('https://ironmotorsportsapi-gbuda.ondigitalocean.app/find-customers');
  } catch (err) {
    console.log(err.response.body.Elements[0].ValidationErrors[0].Message)
    // store the message in cookie
    res.cookie('xeroError', err.response.body.Elements[0].ValidationErrors[0].Message)
    res.redirect('https://ironmotorsportsapi-gbuda.ondigitalocean.app/find-customers');
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
