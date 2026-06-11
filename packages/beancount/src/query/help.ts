export interface Documentation {
  pattern: RegExp;
  content: string;
}

const docs: Documentation[] = [
  {
    pattern: /^(help)?$/i,
    content: `
        Shell utility commands (type help <topic>):
        ===========================================
        clear  help  history  parse  lex tokenize raw
    
        Beancount query commands:
        =========================
        attributes  errors   from     print   runcustom  targets
        balances    explain  journal  reload  select  explain    where
        `,
  },
  {
    pattern: /^(help\s+clear)?$/i,
    content: `
        Clear the history.
        `,
  },
  {
    pattern: /^(help\s+help)?$/i,
    content: `
        Strip superfluous semicolon.
        `,
  },
  {
    pattern: /^(help\s+exit)?$/i,
    content: `
        Doesn't do anything in Fava's query shell.
        `,
  },
  {
    pattern: /^(help\s+history)?$/i,
    content: `
        Print the command-line history statement
        `,
  },
  {
    pattern: /^(help\s+parse)?$/i,
    content: `
        Just run the parser on the following command and print the output.
        `,
  },
  {
    pattern: /^(help\s+(lex|tokenize))?$/i,
    content: `
        Just run the lexer on the following command and print the output.
        `,
  },
  {
    pattern: /^(help\s+raw)?$/i,
    content: `
        Run the raw sql query without any AST changes
        `,
  },
  {
    pattern: /^(help\s+attributes)?$/i,
    content: `
        The attribute names on postings and directives equivalent to the names
        of columns that we make available for query.

        Entries:
        -                                       : description
        -                                       : id
        -                                       : type
        entry.date                              : date
        entry.date.day                          : day
        entry.date.month                        : month
        entry.date.year                         : year
        entry.flag                              : flag
        entry.links                             : links
        entry.meta["filename"]                  : filename
        entry.meta["lineno"]                    : lineno
        entry.narration                         : narration
        entry.payee                             : payee
        entry.tags                              : tags


        Postings:
        -                                       : balance
        -                                       : description
        -                                       : id
        -                                       : location
        -                                       : other_accounts
        -                                       : type
        -                                       : weight
        entry.date                              : date
        entry.date.day                          : day
        entry.date.month                        : month
        entry.date.year                         : year
        entry.flag                              : flag
        entry.links                             : links
        entry.meta["filename"]                  : filename
        entry.meta["lineno"]                    : lineno
        entry.narration                         : narration
        entry.payee                             : payee
        entry.tags                              : tags
        posting                                 : change
        posting                                 : position
        posting.account                         : account
        posting.cost.currency                   : cost_currency
        posting.cost.date                       : cost_date
        posting.cost.label                      : cost_label
        posting.cost.number                     : cost_number
        posting.flag                            : posting_flag
        posting.price                           : price
        posting.units.currency                  : currency
        posting.units.number                    : number 
        `,
  },
  {
    pattern: /^(help\s+errors)?$/i,
    content: `
        Print the errors that occurred during parsing.
        `,
  },
  {
    pattern: /^(help\s+explain)?$/i,
    content: `
        Compile and print a compiled statement for debugging.
        `,
  },
  {
    pattern: /^(help\s+from)?$/i,
    content: `
        A logical expression that consist of columns on directives (mostly
        transactions) and simple functions.

        Available columns:
        'date': The date of the directive. Type: date.
        'day': The day of the date of the directive. Type: int.
        'description': A combination of the payee + narration of the transaction, if
            present. Type: str.
        'filename': The filename where the directive was parsed from or created. Type:
            str.
        'flag': The flag the transaction. Type: str.
        'id': Unique id of a directive. Type: str.
        'lineno': The line number from the file the directive was parsed from. Type:
            int.
        'links': The set of links of the transaction. Type: set.
        'month': The month of the date of the directive. Type: int.
        'narration': The narration of the transaction. Type: str.
        'payee': The payee of the transaction. Type: str.
        'tags': The set of tags of the transaction. Type: set.
        'type': The data type of the directive. Type: str.
        'year': The year of the date of the directive. Type: int.

        Simple functions:
        'ABS(Decimal)': Compute the length of the argument. This works on sequences.
        'ABS(Inventory)': Compute the length of the argument. This works on sequences.
        'ABS(Position)': Compute the length of the argument. This works on sequences.
        'ACCOUNT_SORTKEY(str)': Get a string to sort accounts in order taking into
            account the types.
        'ANY_META(str)': Get metadata from the posting or its parent transaction's
            metadata if not present.
        'CLOSE_DATE(str)': Get the date of the close directive of the account.
        'COALESCE(object,object)': Return the first non-null argument
        'COMMODITY(Amount)': Extract the currency from an Amount.
        'COMMODITY_META(str)': Get the metadata dict of the commodity directive of the
            currency.
        'CONVERT(Amount,str)': Coerce an amount to a particular currency.
        'CONVERT(Amount,str,date)': Coerce an amount to a particular currency.
        'CONVERT(Inventory,str)': Coerce an inventory to a particular currency.
        'CONVERT(Inventory,str,date)': Coerce an inventory to a particular currency.
        'CONVERT(Position,str)': Coerce an amount to a particular currency.
        'CONVERT(Position,str,date)': Coerce an amount to a particular currency.
        'COST(Inventory)': Get the cost of an inventory.
        'COST(Position)': Get the cost of a position.
        'CURRENCY(Amount)': Extract the currency from an Amount.
        'CURRENCY_META(str)': Get the metadata dict of the commodity directive of the
            currency.
        'DATE(int,int,int)': Construct a date with year, month, day arguments
        'DATE(str)': Construct a date with year, month, day arguments
        'DATE_ADD(date,int)': Adds/subtracts number of days from the given date
        'DATE_DIFF(date,date)': Calculates the difference (in days) between two dates
        'DAY(date)': Extract the day from a date.
        'ENTRY_META(str)': Get some metadata key of the parent directive
            (Transaction).
        'FILTER_CURRENCY(Inventory,str)': Filter an inventory to just the specified
            currency.
        'FILTER_CURRENCY(Position,str)': Filter an inventory to just the specified
            currency.
        'FINDFIRST(str,set)': Filter a string sequence by regular expression and
            return the first match.
        'GETITEM(dict,str)': Get the string value of a dict. The value is always
            converted to a string.
        'GETPRICE(str,str)': Fetch a price for something at a particular date
        'GETPRICE(str,str,date)': Fetch a price for something at a particular date
        'GREP(str,str)': Match a group against a string and return only the matched
            portion.
        'GREPN(str,str,int)': Match a pattern with subgroups against a string and
            return the subgroup at the index
        'HAS_ACCOUNT(str)': A predicate, true if the transaction has at least one
            posting matching the regular expression argument.
        'JOINSTR(set)': Join a sequence of strings to a single comma-separated string.
        'LEAF(str)': Get the name of the leaf subaccount.
        'LENGTH(list|set|str)': Compute the length of the argument. This works on
            sequences.
        'LOWER(str)': Convert string to lowercase
        'MAXWIDTH(str,int)': Convert the argument to a substring. This can be used to
            ensure maximum width
        'META(str)': Get some metadata key of the Posting.
        'MONTH(date)': Extract the month from a date.
        'NEG(Amount)': [See class NegAmount]
        'NEG(Decimal)': [See class NegDecimal]
        'NEG(Inventory)': [See class NegInventory]
        'NEG(Position)': [See class NegPosition]
        'NUMBER(Amount)': Extract the number from an Amount.
        'ONLY(str,Inventory)': Get one currency's amount from the inventory.
        'OPEN_DATE(str)': Get the date of the open directive of the account.
        'OPEN_META(str)': Get the metadata dict of the open directive of the account.
        'PARENT(str)': Get the parent name of the account.
        'POSSIGN(Amount,str)': Correct sign of an Amount based on the usual balance of
            associated account.
        'POSSIGN(Decimal,str)': Correct sign of an Amount based on the usual balance
            of associated account.
        'POSSIGN(Inventory,str)': Correct sign of an Amount based on the usual balance
            of associated account.
        'POSSIGN(Position,str)': Correct sign of an Amount based on the usual balance
            of associated account.
        'QUARTER(date)': Extract the quarter from a date.
        'ROOT(str,int)': Get the root name(s) of the account.
        'SAFEDIV(Decimal,Decimal)': A division operation that swallows dbz exceptions
            and outputs 0 instead.
        'SAFEDIV(Decimal,int)': [See class SafeDivInt]
        'STR(object)': Convert the argument to a string.
        'SUBST(str,str,str)': Substitute leftmost non-overlapping occurrences of
            pattern by replacement.
        'TODAY()': Today's date
        'UNITS(Inventory)': Get the number of units of an inventory (stripping cost).
        'UNITS(Position)': Get the number of units of a position (stripping cost).
        'UPPER(str)': Convert string to uppercase
        'VALUE(Inventory)': Coerce an inventory to its market value at the current
            date.
        'VALUE(Inventory,date)': Coerce an inventory to its market value at a
            particular date.
        'VALUE(Position)': Convert a position to its cost currency at the market
            value.
        'VALUE(Position,date)': Convert a position to its cost currency at the market
            value of a particular date.
        'WEEKDAY(date)': Extract a 3-letter weekday from a date.
        'YEAR(date)': Extract the year from a date.
        'YMONTH(date)': Extract the year and month from a date.
        `,
  },
  {
    pattern: /^(help\s+print)?$/i,
    content: `
        Print entries in Beancount format.

        The general form of a PRINT statement includes an SQL-like FROM
        selector:

        PRINT [FROM <from_expr> ...]

        Where:

        from_expr: A logical expression that matches on the attributes of
            the directives. See SELECT command for details (this FROM expression
            supports all the same expressions including its OPEN, CLOSE and
            CLEAR operations).
        `,
  },
  {
    pattern: /^(help\s+runcustom)?$/i,
    content: `
        Run a custom query instead of a SQL command.

        RUN <custom-query-name>

        Where:

        custom-query-name: Should be the name of a custom query to be defined
            in the Beancount input file.
        `,
  },
  {
    pattern: /^(help\s+targets)?$/i,
    content: `
        The list of comma-separated target expressions may consist of columns,
        simple functions and aggregate functions. If you use any aggregate
        function, you must also provide a GROUP-BY clause.

        Available columns:
        'account': The account of the posting. Type: str.
        'balance': The balance for the posting. These can be summed into inventories.
            Type: Inventory.
        'change': The position for the posting. These can be summed into inventories.
            Type: Position.
        'cost_currency': The cost currency of the posting. Type: str.
        'cost_date': The cost currency of the posting. Type: date.
        'cost_label': The cost currency of the posting. Type: str.
        'cost_number': The number of cost units of the posting. Type: Decimal.
        'currency': The currency of the posting. Type: str.
        'date': The date of the parent transaction for this posting. Type: date.
        'day': The day of the date of the parent transaction for this posting. Type:
            int.
        'description': A combination of the payee + narration for the transaction of
            this posting. Type: str.
        'filename': The filename where the posting was parsed from or created. Type:
            str.
        'flag': The flag of the parent transaction for this posting. Type: str.
        'id': The unique id of the parent transaction for this posting. Type: str.
        'lineno': The line number from the file the posting was parsed from. Type:
            int.
        'links': The set of links of the parent transaction for this posting. Type:
            set.
        'location': The filename:lineno where the posting was parsed from or created.
            If you select this column as the first column, because it renders like
            errors, Emacs is able to pick those up and you can navigate between an
            arbitrary list of transactions with next-error and previous-error. Type:
            str.
        'month': The month of the date of the parent transaction for this posting.
            Type: int.
        'narration': The narration of the parent transaction for this posting. Type:
            str.
        'number': The number of units of the posting. Type: Decimal.
        'other_accounts': The list of other accounts in the transaction, excluding
            that of this posting. Type: set.
        'payee': The payee of the parent transaction for this posting. Type: str.
        'position': The position for the posting. These can be summed into
            inventories. Type: Position.
        'posting_flag': The flag of the posting itself. Type: str.
        'price': The price attached to the posting. Type: Amount.
        'tags': The set of tags of the parent transaction for this posting. Type: set.
        'type': The data type of the parent transaction for this posting. Type: str.
        'weight': The computed weight used for this posting. Type: Amount.
        'year': The year of the date of the parent transaction for this posting. Type:
            int.

        Simple functions:
        'ABS(Decimal)': Compute the length of the argument. This works on sequences.
        'ABS(Inventory)': Compute the length of the argument. This works on sequences.
        'ABS(Position)': Compute the length of the argument. This works on sequences.
        'ACCOUNT_SORTKEY(str)': Get a string to sort accounts in order taking into
            account the types.
        'ANY_META(str)': Get metadata from the posting or its parent transaction's
            metadata if not present.
        'CLOSE_DATE(str)': Get the date of the close directive of the account.
        'COALESCE(object,object)': Return the first non-null argument
        'COMMODITY(Amount)': Extract the currency from an Amount.
        'COMMODITY_META(str)': Get the metadata dict of the commodity directive of the
            currency.
        'CONVERT(Amount,str)': Coerce an amount to a particular currency.
        'CONVERT(Amount,str,date)': Coerce an amount to a particular currency.
        'CONVERT(Inventory,str)': Coerce an inventory to a particular currency.
        'CONVERT(Inventory,str,date)': Coerce an inventory to a particular currency.
        'CONVERT(Position,str)': Coerce an amount to a particular currency.
        'CONVERT(Position,str,date)': Coerce an amount to a particular currency.
        'COST(Inventory)': Get the cost of an inventory.
        'COST(Position)': Get the cost of a position.
        'CURRENCY(Amount)': Extract the currency from an Amount.
        'CURRENCY_META(str)': Get the metadata dict of the commodity directive of the
            currency.
        'DATE(int,int,int)': Construct a date with year, month, day arguments
        'DATE(str)': Construct a date with year, month, day arguments
        'DATE_ADD(date,int)': Adds/subtracts number of days from the given date
        'DATE_DIFF(date,date)': Calculates the difference (in days) between two dates
        'DAY(date)': Extract the day from a date.
        'ENTRY_META(str)': Get some metadata key of the parent directive
            (Transaction).
        'FILTER_CURRENCY(Inventory,str)': Filter an inventory to just the specified
            currency.
        'FILTER_CURRENCY(Position,str)': Filter an inventory to just the specified
            currency.
        'FINDFIRST(str,set)': Filter a string sequence by regular expression and
            return the first match.
        'GETITEM(dict,str)': Get the string value of a dict. The value is always
            converted to a string.
        'GETPRICE(str,str)': Fetch a price for something at a particular date
        'GETPRICE(str,str,date)': Fetch a price for something at a particular date
        'GREP(str,str)': Match a group against a string and return only the matched
            portion.
        'GREPN(str,str,int)': Match a pattern with subgroups against a string and
            return the subgroup at the index
        'JOINSTR(set)': Join a sequence of strings to a single comma-separated string.
        'LEAF(str)': Get the name of the leaf subaccount.
        'LENGTH(list|set|str)': Compute the length of the argument. This works on
            sequences.
        'LOWER(str)': Convert string to lowercase
        'MAXWIDTH(str,int)': Convert the argument to a substring. This can be used to
            ensure maximum width
        'META(str)': Get some metadata key of the Posting.
        'MONTH(date)': Extract the month from a date.
        'NEG(Amount)': [See class NegAmount]
        'NEG(Decimal)': [See class NegDecimal]
        'NEG(Inventory)': [See class NegInventory]
        'NEG(Position)': [See class NegPosition]
        'NUMBER(Amount)': Extract the number from an Amount.
        'ONLY(str,Inventory)': Get one currency's amount from the inventory.
        'OPEN_DATE(str)': Get the date of the open directive of the account.
        'OPEN_META(str)': Get the metadata dict of the open directive of the account.
        'PARENT(str)': Get the parent name of the account.
        'POSSIGN(Amount,str)': Correct sign of an Amount based on the usual balance of
            associated account.
        'POSSIGN(Decimal,str)': Correct sign of an Amount based on the usual balance
            of associated account.
        'POSSIGN(Inventory,str)': Correct sign of an Amount based on the usual balance
            of associated account.
        'POSSIGN(Position,str)': Correct sign of an Amount based on the usual balance
            of associated account.
        'QUARTER(date)': Extract the quarter from a date.
        'ROOT(str,int)': Get the root name(s) of the account.
        'SAFEDIV(Decimal,Decimal)': A division operation that swallows dbz exceptions
            and outputs 0 instead.
        'SAFEDIV(Decimal,int)': [See class SafeDivInt]
        'STR(object)': Convert the argument to a string.
        'SUBST(str,str,str)': Substitute leftmost non-overlapping occurrences of
            pattern by replacement.
        'TODAY()': Today's date
        'UNITS(Inventory)': Get the number of units of an inventory (stripping cost).
        'UNITS(Position)': Get the number of units of a position (stripping cost).
        'UPPER(str)': Convert string to uppercase
        'VALUE(Inventory)': Coerce an inventory to its market value at the current
            date.
        'VALUE(Inventory,date)': Coerce an inventory to its market value at a
            particular date.
        'VALUE(Position)': Convert a position to its cost currency at the market
            value.
        'VALUE(Position,date)': Convert a position to its cost currency at the market
            value of a particular date.
        'WEEKDAY(date)': Extract a 3-letter weekday from a date.
        'YEAR(date)': Extract the year from a date.
        'YMONTH(date)': Extract the year and month from a date.

        Aggregate functions:
        'COUNT(object)': Count the number of occurrences of the argument.
        'FIRST(object)': Keep the first of the values seen.
        'LAST(object)': Keep the last of the values seen.
        'MAX(object)': Compute the maximum of the values.
        'MIN(object)': Compute the minimum of the values.
        'SUM(Amount)': Calculate the sum of the amount. The result is an Inventory.
        'SUM(Inventory)': Calculate the sum of the inventories. The result is an
            Inventory.
        'SUM(Position)': Calculate the sum of the position. The result is an
            Inventory.
        'SUM(int|float|Decimal)': Calculate the sum of the numerical argument.
        `,
  },
  {
    pattern: /^(help\s+balances)?$/i,
    content: `
        Select balances of some subset of postings. This command is a
        convenience and converts into an equivalent Select statement, designed
        to extract the most sensible list of columns for the register of a list
        of entries as a table.

        The general form of a JOURNAL statement loosely follows SQL syntax:

        BALANCE [FROM_CLAUSE]

        See the SELECT query help for more details on the FROM clause.
        `,
  },
  {
    pattern: /^(help\s+explain)?$/i,
    content: `
        Select balances of some subset of postings. This command is a
        convenience and converts into an equivalent Select statement, designed
        to extract the most sensible list of columns for the register of a list
        of entries as a table.

        The general form of a JOURNAL statement loosely follows SQL syntax:

        BALANCE [FROM_CLAUSE]

        See the SELECT query help for more details on the FROM clause.
        `,
  },
  {
    pattern: /^(help\s+journal)?$/i,
    content: `
        Select a journal of some subset of postings. This command is a
        convenience and converts into an equivalent Select statement, designed
        to extract the most sensible list of columns for the register of a list
        of entries as a table.

        The general form of a JOURNAL statement loosely follows SQL syntax:

        JOURNAL <account-regexp> [FROM_CLAUSE]

        See the SELECT query help for more details on the FROM clause.
        `,
  },
  {
    pattern: /^(help\s+reload)?$/i,
    content: `
        Reload the input file without restarting the shell.
        `,
  },
  {
    pattern: /^(help\s+select)?$/i,
    content: `
        Extract data from a query on the postings.

        The general form of a SELECT statement loosely follows SQL syntax, with
        some mild and idiomatic extensions:

        SELECT [DISTINCT] [<targets>|*]
        [FROM <from_expr> [OPEN ON <date>] [CLOSE [ON <date>]] [CLEAR]]
        [WHERE <where_expr>]
        [GROUP BY <groups>]
        [ORDER BY <groups> [ASC|DESC]]
        [LIMIT num]

        Where:

        targets: A list of desired output attributes from the postings, and
            expressions on them. Some of the attributes of the parent transaction
            directive are made available in this context as well. Simple functions
            (that return a single value per row) and aggregation functions (that
            return a single value per group) are available. For the complete
            list of supported columns and functions, see help on "targets".
            You can also provide a wildcard here, which will select a reasonable
            default set of columns for rendering a journal.

        from_expr: A logical expression that matches on the attributes of
            the directives (not postings). This allows you to select a subset of
            transactions, so the accounting equation is respected for balance
            reports. For the complete list of supported columns and functions,
            see help on "from".

        where_expr: A logical expression that matches on the attributes of
            postings. The available columns are similar to those in the targets
            clause, without the aggregation functions.

        OPEN clause: replace all the transactions before the given date by
            summarizing entries and transfer Income and Expenses balances to
            Equity.

        CLOSE clause: Remove all the transactions after the given date and

        CLEAR: Transfer final Income and Expenses balances to Equity.
        `,
  },
  {
    pattern: /^(help\s+where)?$/i,
    content: `
        A logical expression that consist of columns on postings and simple
        functions.

        Available columns:
        'account': The account of the posting. Type: str.
        'balance': The balance for the posting. These can be summed into inventories.
            Type: Inventory.
        'change': The position for the posting. These can be summed into inventories.
            Type: Position.
        'cost_currency': The cost currency of the posting. Type: str.
        'cost_date': The cost currency of the posting. Type: date.
        'cost_label': The cost currency of the posting. Type: str.
        'cost_number': The number of cost units of the posting. Type: Decimal.
        'currency': The currency of the posting. Type: str.
        'date': The date of the parent transaction for this posting. Type: date.
        'day': The day of the date of the parent transaction for this posting. Type:
            int.
        'description': A combination of the payee + narration for the transaction of
            this posting. Type: str.
        'filename': The filename where the posting was parsed from or created. Type:
            str.
        'flag': The flag of the parent transaction for this posting. Type: str.
        'id': The unique id of the parent transaction for this posting. Type: str.
        'lineno': The line number from the file the posting was parsed from. Type:
            int.
        'links': The set of links of the parent transaction for this posting. Type:
            set.
        'location': The filename:lineno where the posting was parsed from or created.
            If you select this column as the first column, because it renders like
            errors, Emacs is able to pick those up and you can navigate between an
            arbitrary list of transactions with next-error and previous-error. Type:
            str.
        'month': The month of the date of the parent transaction for this posting.
            Type: int.
        'narration': The narration of the parent transaction for this posting. Type:
            str.
        'number': The number of units of the posting. Type: Decimal.
        'other_accounts': The list of other accounts in the transaction, excluding
            that of this posting. Type: set.
        'payee': The payee of the parent transaction for this posting. Type: str.
        'position': The position for the posting. These can be summed into
            inventories. Type: Position.
        'posting_flag': The flag of the posting itself. Type: str.
        'price': The price attached to the posting. Type: Amount.
        'tags': The set of tags of the parent transaction for this posting. Type: set.
        'type': The data type of the parent transaction for this posting. Type: str.
        'weight': The computed weight used for this posting. Type: Amount.
        'year': The year of the date of the parent transaction for this posting. Type:
            int.

        Simple functions:
        'ABS(Decimal)': Compute the length of the argument. This works on sequences.
        'ABS(Inventory)': Compute the length of the argument. This works on sequences.
        'ABS(Position)': Compute the length of the argument. This works on sequences.
        'ACCOUNT_SORTKEY(str)': Get a string to sort accounts in order taking into
            account the types.
        'ANY_META(str)': Get metadata from the posting or its parent transaction's
            metadata if not present.
        'CLOSE_DATE(str)': Get the date of the close directive of the account.
        'COALESCE(object,object)': Return the first non-null argument
        'COMMODITY(Amount)': Extract the currency from an Amount.
        'COMMODITY_META(str)': Get the metadata dict of the commodity directive of the
            currency.
        'CONVERT(Amount,str)': Coerce an amount to a particular currency.
        'CONVERT(Amount,str,date)': Coerce an amount to a particular currency.
        'CONVERT(Inventory,str)': Coerce an inventory to a particular currency.
        'CONVERT(Inventory,str,date)': Coerce an inventory to a particular currency.
        'CONVERT(Position,str)': Coerce an amount to a particular currency.
        'CONVERT(Position,str,date)': Coerce an amount to a particular currency.
        'COST(Inventory)': Get the cost of an inventory.
        'COST(Position)': Get the cost of a position.
        'CURRENCY(Amount)': Extract the currency from an Amount.
        'CURRENCY_META(str)': Get the metadata dict of the commodity directive of the
            currency.
        'DATE(int,int,int)': Construct a date with year, month, day arguments
        'DATE(str)': Construct a date with year, month, day arguments
        'DATE_ADD(date,int)': Adds/subtracts number of days from the given date
        'DATE_DIFF(date,date)': Calculates the difference (in days) between two dates
        'DAY(date)': Extract the day from a date.
        'ENTRY_META(str)': Get some metadata key of the parent directive
            (Transaction).
        'FILTER_CURRENCY(Inventory,str)': Filter an inventory to just the specified
            currency.
        'FILTER_CURRENCY(Position,str)': Filter an inventory to just the specified
            currency.
        'FINDFIRST(str,set)': Filter a string sequence by regular expression and
            return the first match.
        'GETITEM(dict,str)': Get the string value of a dict. The value is always
            converted to a string.
        'GETPRICE(str,str)': Fetch a price for something at a particular date
        'GETPRICE(str,str,date)': Fetch a price for something at a particular date
        'GREP(str,str)': Match a group against a string and return only the matched
            portion.
        'GREPN(str,str,int)': Match a pattern with subgroups against a string and
            return the subgroup at the index
        'JOINSTR(set)': Join a sequence of strings to a single comma-separated string.
        'LEAF(str)': Get the name of the leaf subaccount.
        'LENGTH(list|set|str)': Compute the length of the argument. This works on
            sequences.
        'LOWER(str)': Convert string to lowercase
        'MAXWIDTH(str,int)': Convert the argument to a substring. This can be used to
            ensure maximum width
        'META(str)': Get some metadata key of the Posting.
        'MONTH(date)': Extract the month from a date.
        'NEG(Amount)': [See class NegAmount]
        'NEG(Decimal)': [See class NegDecimal]
        'NEG(Inventory)': [See class NegInventory]
        'NEG(Position)': [See class NegPosition]
        'NUMBER(Amount)': Extract the number from an Amount.
        'ONLY(str,Inventory)': Get one currency's amount from the inventory.
        'OPEN_DATE(str)': Get the date of the open directive of the account.
        'OPEN_META(str)': Get the metadata dict of the open directive of the account.
        'PARENT(str)': Get the parent name of the account.
        'POSSIGN(Amount,str)': Correct sign of an Amount based on the usual balance of
            associated account.
        'POSSIGN(Decimal,str)': Correct sign of an Amount based on the usual balance
            of associated account.
        'POSSIGN(Inventory,str)': Correct sign of an Amount based on the usual balance
            of associated account.
        'POSSIGN(Position,str)': Correct sign of an Amount based on the usual balance
            of associated account.
        'QUARTER(date)': Extract the quarter from a date.
        'ROOT(str,int)': Get the root name(s) of the account.
        'SAFEDIV(Decimal,Decimal)': A division operation that swallows dbz exceptions
            and outputs 0 instead.
        'SAFEDIV(Decimal,int)': [See class SafeDivInt]
        'STR(object)': Convert the argument to a string.
        'SUBST(str,str,str)': Substitute leftmost non-overlapping occurrences of
            pattern by replacement.
        'TODAY()': Today's date
        'UNITS(Inventory)': Get the number of units of an inventory (stripping cost).
        'UNITS(Position)': Get the number of units of a position (stripping cost).
        'UPPER(str)': Convert string to uppercase
        'VALUE(Inventory)': Coerce an inventory to its market value at the current
            date.
        'VALUE(Inventory,date)': Coerce an inventory to its market value at a
            particular date.
        'VALUE(Position)': Convert a position to its cost currency at the market
            value.
        'VALUE(Position,date)': Convert a position to its cost currency at the market
            value of a particular date.
        'WEEKDAY(date)': Extract a 3-letter weekday from a date.
        'YEAR(date)': Extract the year from a date.
        'YMONTH(date)': Extract the year and month from a date.
        `,
  },
];

export function helpFor(query: string) {
  query = query.trim();
  const doc = docs.find((it) => it.pattern.test(query));
  return doc ? { Help: doc.content } : null;
}
