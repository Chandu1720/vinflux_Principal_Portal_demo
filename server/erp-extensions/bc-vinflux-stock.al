// Business Central extension page for VinFlux: stock by location / lot / serial / expiry.
// The standard API v2.0 only exposes a total per item, so install this in the principal's tenant
// (AL extension, any object ID in their free range) and set VFX_D365BC_STOCK_API=vinflux/stock/v1.0.
page 50140 "VinFlux Stock Lines API"
{
    PageType = API;
    APIPublisher = 'vinflux';
    APIGroup = 'stock';
    APIVersion = 'v1.0';
    EntityName = 'stockLine';
    EntitySetName = 'stockLines';
    SourceTable = "Item Ledger Entry";
    SourceTableView = where(Open = const(true));
    DelayedInsert = true;
    Editable = false;
    DataAccessIntent = ReadOnly;

    layout
    {
        area(Content)
        {
            repeater(Lines)
            {
                field(entryNo; Rec."Entry No.") { }
                field(itemNo; Rec."Item No.") { }
                field(variantCode; Rec."Variant Code") { }
                field(locationCode; Rec."Location Code") { }
                field(lotNo; Rec."Lot No.") { }
                field(serialNo; Rec."Serial No.") { }
                field(expirationDate; Rec."Expiration Date") { }
                field(remainingQuantity; Rec."Remaining Quantity") { }
            }
        }
    }
}
